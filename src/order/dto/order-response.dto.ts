import { OrderStatus } from '@prisma/client';

export class OrderItemResponseDto {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
}

export class OrderResponseDto {
  id: string;
  idempotencyKey: string;
  status: OrderStatus;
  totalAmount: number;
  items: OrderItemResponseDto[];
  createdAt: Date;

  static from(order: {
    id: string;
    idempotencyKey: string;
    status: OrderStatus;
    totalAmount: number;
    createdAt: Date;
    items: Array<{
      id: string;
      productId: string;
      quantity: number;
      unitPrice: number;
    }>;
  }): OrderResponseDto {
    const dto = new OrderResponseDto();
    dto.id = order.id;
    dto.idempotencyKey = order.idempotencyKey;
    dto.status = order.status;
    dto.totalAmount = order.totalAmount;
    dto.createdAt = order.createdAt;
    dto.items = order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));
    return dto;
  }
}
