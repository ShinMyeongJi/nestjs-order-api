import { Injectable, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BusinessException, ErrorCodes } from '../common';
import { ProductResponseDto } from './dto/product-response.dto';

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return products.map(ProductResponseDto.from);
  }

  async findById(id: string): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findUnique({ where: { id } });
    if (!product) {
      throw new BusinessException(
        ErrorCodes.PRODUCT_NOT_FOUND,
        `Product not found: ${id}`,
        HttpStatus.NOT_FOUND,
      );
    }
    return ProductResponseDto.from(product);
  }

  /**
   * 재고 차감 - Atomic Update 패턴
   * - WHERE 조건에 stock >= quantity를 포함하여 DB 레벨에서 동시성 제어
   * - 애플리케이션 레벨 락 없이도 Race Condition 방지
   * - updateMany는 조건 불일치 시 count: 0을 반환 (예외 대신)
   */
  async decreaseStock(productId: string, quantity: number): Promise<void> {
    const result = await this.prisma.product.updateMany({
      where: {
        id: productId,
        stock: { gte: quantity }, // 재고가 충분한 경우에만 차감
      },
      data: {
        stock: { decrement: quantity },
      },
    });

    // 영향받은 행이 0이면 재고 부족 또는 상품 미존재
    if (result.count === 0) {
      throw new BusinessException(
        ErrorCodes.INSUFFICIENT_STOCK,
        `Insufficient stock for product: ${productId}`,
        HttpStatus.CONFLICT,
      );
    }
  }

  /**
   * 재고 복원 - 주문 취소/결제 실패 시 사용
   */
  async restoreStock(productId: string, quantity: number): Promise<void> {
    await this.prisma.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    });
  }
}
