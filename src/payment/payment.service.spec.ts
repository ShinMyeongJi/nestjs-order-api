import { Test, TestingModule } from '@nestjs/testing';
import { PaymentService } from './payment.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { BusinessException } from '../common';
import { ErrorCodes } from '../common/exceptions/error-codes';

describe('PaymentService', () => {
  let service: PaymentService;
  let prisma: jest.Mocked<PrismaService>;
  let orderService: jest.Mocked<OrderService>;
  let gateway: jest.Mocked<PaymentGatewayService>;

  const mockOrder = {
    id: 'order-1',
    idempotencyKey: 'idem-1',
    status: 'PENDING' as const,
    totalAmount: 30000,
    createdAt: new Date(),
    updatedAt: new Date(),
    payments: [],
    items: [
      { id: 'item-1', orderId: 'order-1', productId: 'product-1', quantity: 3, unitPrice: 10000 },
    ],
  };

  const mockPayment = {
    id: 'payment-1',
    orderId: 'order-1',
    amount: 30000,
    status: 'APPROVED' as const,
    transactionId: 'TXN-123',
    failureReason: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTx = {
    payment: { create: jest.fn() },
    order: { findUnique: jest.fn(), update: jest.fn() },
    product: { update: jest.fn() },
  };

  beforeEach(async () => {
    const mockPrisma = {
      order: { findUnique: jest.fn() },
      payment: { findMany: jest.fn() },
      $transaction: jest.fn(),
    };

    const mockOrderService = {
      transitionStatus: jest.fn(),
    };

    const mockGateway = {
      processPayment: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: OrderService, useValue: mockOrderService },
        { provide: PaymentGatewayService, useValue: mockGateway },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    prisma = module.get(PrismaService);
    orderService = module.get(OrderService);
    gateway = module.get(PaymentGatewayService);
  });

  describe('processPayment', () => {
    it('should process payment and transition order to COMPLETED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      gateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'TXN-123',
        failureReason: null,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.payment.create.mockResolvedValue(mockPayment);
        return cb(mockTx);
      });

      const result = await service.processPayment({ orderId: 'order-1' });

      expect(result.status).toBe('APPROVED');
      expect(result.transactionId).toBe('TXN-123');
      // State Machine을 통한 상태 전이가 호출되었는지 확인
      expect(orderService.transitionStatus).toHaveBeenCalledWith(
        'order-1',
        'COMPLETED',
        mockTx, // tx 객체가 전달되어 같은 트랜잭션에 참여
      );
    });

    it('should throw ORDER_NOT_FOUND when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.processPayment({ orderId: 'non-existent' }),
      ).rejects.toThrow(BusinessException);

      try {
        await service.processPayment({ orderId: 'non-existent' });
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.ORDER_NOT_FOUND,
        );
      }
    });

    it('should throw ORDER_ALREADY_PAID when order is COMPLETED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      await expect(
        service.processPayment({ orderId: 'order-1' }),
      ).rejects.toThrow(BusinessException);

      try {
        await service.processPayment({ orderId: 'order-1' });
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.ORDER_ALREADY_PAID,
        );
      }
    });

    it('should throw INVALID_ORDER_STATUS when order is CANCELLED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await expect(
        service.processPayment({ orderId: 'order-1' }),
      ).rejects.toThrow(BusinessException);

      try {
        await service.processPayment({ orderId: 'order-1' });
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.INVALID_ORDER_STATUS,
        );
      }
    });

    it('should throw PAYMENT_ALREADY_PROCESSED when approved payment exists', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        payments: [{ ...mockPayment, status: 'APPROVED' }],
      });

      await expect(
        service.processPayment({ orderId: 'order-1' }),
      ).rejects.toThrow(BusinessException);

      try {
        await service.processPayment({ orderId: 'order-1' });
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.PAYMENT_ALREADY_PROCESSED,
        );
      }
    });

    it('should restore stock in same transaction when payment fails', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      gateway.processPayment.mockResolvedValue({
        success: false,
        transactionId: null,
        failureReason: 'Payment declined by issuer',
      });

      const failedPayment = {
        ...mockPayment,
        status: 'FAILED' as const,
        transactionId: null,
        failureReason: 'Payment declined by issuer',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.payment.create.mockResolvedValue(failedPayment);
        return cb(mockTx);
      });

      await expect(
        service.processPayment({ orderId: 'order-1' }),
      ).rejects.toThrow(BusinessException);

      // 상태 전이가 FAILED로 호출되었는지 확인
      expect(orderService.transitionStatus).toHaveBeenCalledWith(
        'order-1',
        'FAILED',
        mockTx,
      );

      // 재고 복원이 같은 트랜잭션(tx) 안에서 호출되었는지 확인
      expect(mockTx.product.update).toHaveBeenCalledWith({
        where: { id: 'product-1' },
        data: { stock: { increment: 3 } },
      });
    });

    it('should allow retry after failed payment', async () => {
      const orderWithFailedPayment = {
        ...mockOrder,
        payments: [
          { ...mockPayment, status: 'FAILED', transactionId: null },
        ],
      };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(
        orderWithFailedPayment,
      );

      gateway.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'TXN-456',
        failureReason: null,
      });

      const approvedPayment = {
        ...mockPayment,
        id: 'payment-2',
        transactionId: 'TXN-456',
      };

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.payment.create.mockResolvedValue(approvedPayment);
        return cb(mockTx);
      });

      const result = await service.processPayment({ orderId: 'order-1' });

      expect(result.status).toBe('APPROVED');
      expect(result.transactionId).toBe('TXN-456');
    });

    it('should not call PG when order validation fails (성능 최적화)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      try {
        await service.processPayment({ orderId: 'order-1' });
      } catch {
        // PG 호출이 되지 않았는지 확인 — 불필요한 외부 API 호출 방지
        expect(gateway.processPayment).not.toHaveBeenCalled();
      }
    });

    // === HTTP 상태 코드 정확성 검증 ===

    it('should return 404 for ORDER_NOT_FOUND (4xx, not 5xx)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      try {
        await service.processPayment({ orderId: 'non-existent' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as BusinessException).getStatus()).toBe(404);
      }
    });

    it('should return 409 for ORDER_ALREADY_PAID (4xx, not 5xx)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      try {
        await service.processPayment({ orderId: 'order-1' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as BusinessException).getStatus()).toBe(409);
      }
    });

    it('should return 400 for INVALID_ORDER_STATUS (4xx, not 5xx)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      try {
        await service.processPayment({ orderId: 'order-1' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as BusinessException).getStatus()).toBe(400);
      }
    });

    it('should return 409 for PAYMENT_ALREADY_PROCESSED (4xx, not 5xx)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        payments: [{ ...mockPayment, status: 'APPROVED' }],
      });

      try {
        await service.processPayment({ orderId: 'order-1' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as BusinessException).getStatus()).toBe(409);
      }
    });

    it('should return 422 for PAYMENT_FAILED — PG 거절 (4xx, not 5xx)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      gateway.processPayment.mockResolvedValue({
        success: false,
        transactionId: null,
        failureReason: 'Insufficient funds',
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.payment.create.mockResolvedValue({
          ...mockPayment,
          status: 'FAILED',
        });
        return cb(mockTx);
      });

      try {
        await service.processPayment({ orderId: 'order-1' });
        fail('Should have thrown');
      } catch (error) {
        expect((error as BusinessException).getStatus()).toBe(422);
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.PAYMENT_FAILED,
        );
      }
    });

    it('should propagate 502 from gateway when PG is down (5xx — 외부 장애)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      // PG 게이트웨이가 502 BusinessException을 던지는 케이스
      gateway.processPayment.mockRejectedValue(
        new BusinessException(
          ErrorCodes.PAYMENT_GATEWAY_ERROR,
          'Payment gateway is temporarily unavailable',
          502,
        ),
      );

      try {
        await service.processPayment({ orderId: 'order-1' });
        fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(BusinessException);
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.PAYMENT_GATEWAY_ERROR,
        );
        // 502 Bad Gateway — 우리 서버 버그(500)와 구분
        expect((error as BusinessException).getStatus()).toBe(502);
      }
    });
  });

  describe('findByOrderId', () => {
    it('should return payments for an order', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([mockPayment]);

      const result = await service.findByOrderId('order-1');

      expect(result).toHaveLength(1);
      expect(result[0].orderId).toBe('order-1');
      expect(prisma.payment.findMany).toHaveBeenCalledWith({
        where: { orderId: 'order-1' },
        orderBy: { createdAt: 'desc' },
      });
    });

    it('should return empty array when no payments exist', async () => {
      (prisma.payment.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.findByOrderId('order-1');

      expect(result).toHaveLength(0);
    });
  });
});
