import { Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';

export class OrderItemDto {
  @IsUUID()
  @IsNotEmpty()
  productId: string;

  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  quantity: number;
}

/**
 * 주문 생성 요청 DTO
 * - idempotencyKey: 클라이언트가 생성한 고유 키로 중복 주문 방지
 * - items: 최소 1개 이상의 주문 항목 필수
 */
export class CreateOrderDto {
  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'Order must contain at least one item' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];
}
