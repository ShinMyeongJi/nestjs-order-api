import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OrderService } from '../order/order.service';
import { BusinessException, ErrorCodes } from '../common';
import { PaymentGatewayService } from './payment-gateway.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { PaymentResponseDto } from './dto/payment-response.dto';

/**
 * 결제 서비스
 *
 * DI 구조 비교 (Spring vs NestJS):
 * - Spring: @Service + @Autowired (또는 생성자 주입) → Bean Container가 관리
 * - NestJS: @Injectable() + constructor 주입 → Module의 providers 배열에 등록
 *
 * 핵심 차이: Spring은 ComponentScan으로 자동 등록이 기본이지만,
 * NestJS는 각 Module의 providers에 명시적으로 등록해야 함.
 * exports 배열에 추가해야 다른 모듈에서 주입 가능 (Spring의 @Bean + public 접근과 유사).
 */
@Injectable()
export class PaymentService {
  private readonly logger = new Logger(PaymentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orderService: OrderService,
    private readonly paymentGateway: PaymentGatewayService,
  ) {}

  /**
   * 결제 처리 — 주문 검증 → PG 요청 → 결제+상태+재고를 하나의 트랜잭션으로 처리
   *
   * Interactive Transaction 사용 이유:
   * Prisma의 $transaction(async (tx) => {...})는 Spring의 @Transactional과 대응.
   * tx 객체를 통해 실행되는 모든 쿼리가 동일 DB 트랜잭션에 묶이며,
   * 콜백 내에서 예외 발생 시 자동 ROLLBACK.
   *
   * 주의: PG 호출은 트랜잭션 밖에서 수행 (외부 API 호출을 트랜잭션에 포함하면
   * 커넥션 점유 시간이 길어져 DB 성능 저하 유발)
   */
  async processPayment(dto: ProcessPaymentDto): Promise<PaymentResponseDto> {
    // 1. 주문 검증 (트랜잭션 밖 — 읽기 전용)
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { payments: true, items: true },
    });

    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        `Order not found: ${dto.orderId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // 이미 완료된 주문은 결제 불가
    if (order.status === 'COMPLETED') {
      throw new BusinessException(
        ErrorCodes.ORDER_ALREADY_PAID,
        `Order already paid: ${dto.orderId}`,
        HttpStatus.CONFLICT,
      );
    }

    // State Machine 검증 — PENDING만 결제 가능 (CANCELLED, FAILED 등 차단)
    if (order.status !== 'PENDING') {
      throw new BusinessException(
        ErrorCodes.INVALID_ORDER_STATUS,
        `Order status must be PENDING, current: ${order.status}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // 2. 이미 승인된 결제가 있는지 확인 (중복 결제 방지)
    const approvedPayment = order.payments.find(
      (p) => p.status === 'APPROVED',
    );
    if (approvedPayment) {
      throw new BusinessException(
        ErrorCodes.PAYMENT_ALREADY_PROCESSED,
        `Payment already approved for order: ${dto.orderId}`,
        HttpStatus.CONFLICT,
      );
    }

    // 3. Mock PG 결제 요청 (트랜잭션 밖 — 외부 API 호출은 DB 커넥션을 점유하지 않도록)
    const gatewayResult = await this.paymentGateway.processPayment(
      order.id,
      order.totalAmount,
    );

    // 4. 결제 결과 저장 + 주문 상태 전이 + (실패 시) 재고 복원을 하나의 트랜잭션으로
    const payment = await this.prisma.$transaction(async (tx) => {
      const createdPayment = await tx.payment.create({
        data: {
          orderId: order.id,
          amount: order.totalAmount,
          status: gatewayResult.success ? 'APPROVED' : 'FAILED',
          transactionId: gatewayResult.transactionId,
          failureReason: gatewayResult.failureReason,
        },
      });

      if (gatewayResult.success) {
        // State Machine을 통한 상태 전이 (tx를 전달하여 같은 트랜잭션에 참여)
        await this.orderService.transitionStatus(order.id, 'COMPLETED', tx);
        this.logger.log(`Payment approved for order: ${order.id}`);
      } else {
        // 결제 실패: 상태 전이 + 재고 복원을 같은 트랜잭션에서 처리
        await this.orderService.transitionStatus(order.id, 'FAILED', tx);

        // 재고 복원도 트랜잭션 안에서 — 부분 복원 방지
        for (const item of order.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });
        }

        this.logger.warn(
          `Payment failed for order: ${order.id}, reason: ${gatewayResult.failureReason}`,
        );
      }

      return createdPayment;
    });

    if (!gatewayResult.success) {
      throw new BusinessException(
        ErrorCodes.PAYMENT_FAILED,
        `Payment failed: ${gatewayResult.failureReason}`,
        HttpStatus.UNPROCESSABLE_ENTITY,
      );
    }

    return PaymentResponseDto.from(payment);
  }

  async findByOrderId(orderId: string): Promise<PaymentResponseDto[]> {
    const payments = await this.prisma.payment.findMany({
      where: { orderId },
      orderBy: { createdAt: 'desc' },
    });
    return payments.map(PaymentResponseDto.from);
  }
}
