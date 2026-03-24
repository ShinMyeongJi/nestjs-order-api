import { IsNotEmpty, IsUUID } from 'class-validator';

/**
 * 결제 승인 요청 DTO
 * - orderId만 받아서 해당 주문의 totalAmount로 결제 처리
 */
export class ProcessPaymentDto {
  @IsUUID()
  @IsNotEmpty()
  orderId: string;
}
