import { PaymentStatus } from '@prisma/client';

export class PaymentResponseDto {
  id: string;
  orderId: string;
  amount: number;
  status: PaymentStatus;
  transactionId: string | null;
  createdAt: Date;

  static from(payment: {
    id: string;
    orderId: string;
    amount: number;
    status: PaymentStatus;
    transactionId: string | null;
    createdAt: Date;
  }): PaymentResponseDto {
    const dto = new PaymentResponseDto();
    dto.id = payment.id;
    dto.orderId = payment.orderId;
    dto.amount = payment.amount;
    dto.status = payment.status;
    dto.transactionId = payment.transactionId;
    dto.createdAt = payment.createdAt;
    return dto;
  }
}
