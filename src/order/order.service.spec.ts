import { Test, TestingModule } from '@nestjs/testing';
import { OrderService } from './order.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { BusinessException } from '../common';
import { ErrorCodes } from '../common/exceptions/error-codes';
import { CreateOrderDto } from './dto/create-order.dto';

describe('OrderService', () => {
  let service: OrderService;
  let prisma: jest.Mocked<PrismaService>;

  const mockOrder = {
    id: 'order-1',
    idempotencyKey: 'idem-key-1',
    status: 'PENDING' as const,
    totalAmount: 30000,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    items: [
      {
        id: 'item-1',
        orderId: 'order-1',
        productId: 'product-1',
        quantity: 3,
        unitPrice: 10000,
      },
    ],
  };

  const mockProduct = {
    id: 'product-1',
    name: 'Test Product',
    description: null,
    price: 10000,
    stock: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTx = {
    product: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
    },
    order: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const mockPrisma = {
      order: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ProductService, useValue: {} },
      ],
    }).compile();

    service = module.get<OrderService>(OrderService);
    prisma = module.get(PrismaService);
  });

  describe('createOrder', () => {
    const createOrderDto: CreateOrderDto = {
      idempotencyKey: 'idem-key-1',
      items: [{ productId: 'product-1', quantity: 3 }],
    };

    it('should create a new order with PENDING status', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.product.findUnique.mockResolvedValue(mockProduct);
        mockTx.product.updateMany.mockResolvedValue({ count: 1 });
        mockTx.order.create.mockResolvedValue(mockOrder);
        return cb(mockTx);
      });

      const result = await service.createOrder(createOrderDto);

      expect(result.id).toBe('order-1');
      expect(result.status).toBe('PENDING');
      expect(result.totalAmount).toBe(30000);
      expect(result.items).toHaveLength(1);
    });

    it('should return existing order for duplicate idempotency key', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.createOrder(createOrderDto);

      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(result.id).toBe('order-1');
      expect(result.idempotencyKey).toBe('idem-key-1');
    });

    it('should throw PRODUCT_NOT_FOUND when product does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.product.findUnique.mockResolvedValue(null);
        return cb(mockTx);
      });

      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.createOrder(createOrderDto);
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.PRODUCT_NOT_FOUND,
        );
      }
    });

    it('should throw INSUFFICIENT_STOCK when stock is not enough', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.product.findUnique.mockResolvedValue(mockProduct);
        mockTx.product.updateMany.mockResolvedValue({ count: 0 });
        return cb(mockTx);
      });

      await expect(service.createOrder(createOrderDto)).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.createOrder(createOrderDto);
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.INSUFFICIENT_STOCK,
        );
      }
    });

    it('should calculate total amount correctly for multiple items', async () => {
      const multiItemDto: CreateOrderDto = {
        idempotencyKey: 'idem-key-2',
        items: [
          { productId: 'product-1', quantity: 2 },
          { productId: 'product-2', quantity: 1 },
        ],
      };

      const product2 = { ...mockProduct, id: 'product-2', price: 20000 };

      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) => {
        mockTx.product.findUnique
          .mockResolvedValueOnce(mockProduct)
          .mockResolvedValueOnce(product2);
        mockTx.product.updateMany.mockResolvedValue({ count: 1 });
        mockTx.order.create.mockResolvedValue({
          ...mockOrder,
          id: 'order-2',
          totalAmount: 40000,
          items: [
            { id: 'i1', productId: 'product-1', quantity: 2, unitPrice: 10000 },
            { id: 'i2', productId: 'product-2', quantity: 1, unitPrice: 20000 },
          ],
        });
        return cb(mockTx);
      });

      const result = await service.createOrder(multiItemDto);

      expect(result.totalAmount).toBe(40000);
      expect(result.items).toHaveLength(2);
    });
  });

  describe('transitionStatus', () => {
    it('should transition PENDING → COMPLETED via State Machine', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      await expect(
        service.transitionStatus('order-1', 'COMPLETED'),
      ).resolves.toBeUndefined();

      expect(prisma.order.update).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        data: { status: 'COMPLETED' },
      });
    });

    it('should transition PENDING → FAILED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'FAILED',
      });

      await expect(
        service.transitionStatus('order-1', 'FAILED'),
      ).resolves.toBeUndefined();
    });

    it('should transition PENDING → CANCELLED', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);
      (prisma.order.update as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await expect(
        service.transitionStatus('order-1', 'CANCELLED'),
      ).resolves.toBeUndefined();
    });

    it('should reject COMPLETED → PENDING (비논리적 전이 차단)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'COMPLETED',
      });

      await expect(
        service.transitionStatus('order-1', 'PENDING'),
      ).rejects.toThrow(BusinessException);

      try {
        await service.transitionStatus('order-1', 'PENDING');
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.INVALID_ORDER_STATUS,
        );
      }
    });

    it('should reject CANCELLED → COMPLETED (최종 상태에서 전이 불가)', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue({
        ...mockOrder,
        status: 'CANCELLED',
      });

      await expect(
        service.transitionStatus('order-1', 'COMPLETED'),
      ).rejects.toThrow(BusinessException);
    });

    it('should throw ORDER_NOT_FOUND when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.transitionStatus('non-existent', 'COMPLETED'),
      ).rejects.toThrow(BusinessException);

      try {
        await service.transitionStatus('non-existent', 'COMPLETED');
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.ORDER_NOT_FOUND,
        );
      }
    });

    it('should use provided tx client when given (트랜잭션 참여)', async () => {
      const mockTxClient = {
        order: {
          findUnique: jest.fn().mockResolvedValue(mockOrder),
          update: jest.fn().mockResolvedValue({ ...mockOrder, status: 'COMPLETED' }),
        },
      };

      await service.transitionStatus(
        'order-1',
        'COMPLETED',
        mockTxClient as any,
      );

      // tx 클라이언트가 사용되었는지 확인 (prisma 직접 호출이 아닌)
      expect(mockTxClient.order.findUnique).toHaveBeenCalled();
      expect(mockTxClient.order.update).toHaveBeenCalled();
      expect(prisma.order.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return order with items', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(mockOrder);

      const result = await service.findById('order-1');

      expect(result.id).toBe('order-1');
      expect(result.items).toHaveLength(1);
      expect(prisma.order.findUnique).toHaveBeenCalledWith({
        where: { id: 'order-1' },
        include: { items: true },
      });
    });

    it('should throw ORDER_NOT_FOUND when order does not exist', async () => {
      (prisma.order.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(
        BusinessException,
      );

      try {
        await service.findById('non-existent');
      } catch (error) {
        expect((error as BusinessException).errorCode).toBe(
          ErrorCodes.ORDER_NOT_FOUND,
        );
      }
    });
  });

  describe('findAll', () => {
    it('should return all orders sorted by createdAt desc', async () => {
      (prisma.order.findMany as jest.Mock).mockResolvedValue([mockOrder]);

      const result = await service.findAll();

      expect(result).toHaveLength(1);
      expect(prisma.order.findMany).toHaveBeenCalledWith({
        include: { items: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
