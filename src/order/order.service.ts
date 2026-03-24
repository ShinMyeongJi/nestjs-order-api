import { Injectable, HttpStatus, Logger } from '@nestjs/common';
import { Prisma, OrderStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductService } from '../product/product.service';
import { BusinessException, ErrorCodes } from '../common';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderResponseDto } from './dto/order-response.dto';
import { OrderStatusMachine } from './order-status.machine';

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly productService: ProductService,
  ) {}

  /**
   * 주문 생성 - Prisma Interactive Transaction으로 원자성 보장
   *
   * Spring의 @Transactional과 대응.
   * Prisma의 Interactive Transaction은 내부적으로 BEGIN → COMMIT/ROLLBACK을 관리하며,
   * 콜백 내에서 예외 발생 시 자동 롤백됨.
   * (격리 수준은 MySQL 기본값인 REPEATABLE READ를 따름)
   *
   * 처리 흐름:
   * 1. Idempotency Key 중복 검사 (이미 존재하면 기존 주문 반환)
   * 2. 상품 존재 여부 및 가격 조회
   * 3. 재고 차감 (Atomic Update)
   * 4. 주문 + 주문항목 생성
   */
  async createOrder(dto: CreateOrderDto): Promise<OrderResponseDto> {
    // 1. Idempotency: 동일 키로 이미 생성된 주문이 있으면 그대로 반환
    const existingOrder = await this.prisma.order.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      include: { items: true },
    });

    if (existingOrder) {
      this.logger.warn(
        `Duplicate order request detected: ${dto.idempotencyKey}`,
      );
      return OrderResponseDto.from(existingOrder);
    }

    // 2. Interactive Transaction — tx 객체를 통해 모든 쿼리가 같은 트랜잭션에서 실행
    return this.prisma.$transaction(async (tx) => {
      // 2-1. 상품 조회 및 가격 확인
      const productDetails = await Promise.all(
        dto.items.map(async (item) => {
          const product = await tx.product.findUnique({
            where: { id: item.productId },
          });
          if (!product) {
            throw new BusinessException(
              ErrorCodes.PRODUCT_NOT_FOUND,
              `Product not found: ${item.productId}`,
              HttpStatus.NOT_FOUND,
            );
          }
          return { ...item, unitPrice: product.price };
        }),
      );

      // 2-2. 재고 차감 (Atomic Update — DB 레벨 동시성 제어)
      for (const item of productDetails) {
        const result = await tx.product.updateMany({
          where: {
            id: item.productId,
            stock: { gte: item.quantity },
          },
          data: {
            stock: { decrement: item.quantity },
          },
        });

        if (result.count === 0) {
          throw new BusinessException(
            ErrorCodes.INSUFFICIENT_STOCK,
            `Insufficient stock for product: ${item.productId}`,
            HttpStatus.CONFLICT,
          );
        }
      }

      // 2-3. 총 금액 계산
      const totalAmount = productDetails.reduce(
        (sum, item) => sum + item.unitPrice * item.quantity,
        0,
      );

      // 2-4. 주문 생성 (주문항목 포함)
      const order = await tx.order.create({
        data: {
          idempotencyKey: dto.idempotencyKey,
          totalAmount,
          status: 'PENDING',
          items: {
            create: productDetails.map((item) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
        include: { items: true },
      });

      this.logger.log(`Order created: ${order.id}`);
      return OrderResponseDto.from(order);
    });
  }

  /**
   * 주문 상태 전이 — State Machine을 통한 검증 후 업데이트
   *
   * PaymentService 등 외부 모듈이 직접 order.update를 호출하지 않고,
   * 반드시 이 메서드를 통해 상태를 변경하도록 강제.
   * → Spring에서 도메인 서비스가 상태 변경을 캡슐화하는 패턴과 동일.
   *
   * tx 파라미터를 받아서 호출자의 트랜잭션에 참여 가능 (Spring의 REQUIRED 전파와 유사)
   */
  async transitionStatus(
    orderId: string,
    nextStatus: OrderStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx || this.prisma;

    const order = await client.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        `Order not found: ${orderId}`,
        HttpStatus.NOT_FOUND,
      );
    }

    // State Machine이 전이 규칙을 검증 — 위반 시 예외
    OrderStatusMachine.validateTransition(order.status, nextStatus);

    await client.order.update({
      where: { id: orderId },
      data: { status: nextStatus },
    });

    this.logger.log(
      `Order ${orderId} status: ${order.status} → ${nextStatus}`,
    );
  }

  async findById(id: string): Promise<OrderResponseDto> {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });

    if (!order) {
      throw new BusinessException(
        ErrorCodes.ORDER_NOT_FOUND,
        `Order not found: ${id}`,
        HttpStatus.NOT_FOUND,
      );
    }

    return OrderResponseDto.from(order);
  }

  async findAll(): Promise<OrderResponseDto[]> {
    const orders = await this.prisma.order.findMany({
      include: { items: true },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map(OrderResponseDto.from);
  }
}
