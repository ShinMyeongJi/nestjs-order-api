/**
 * 상품 조회 응답 DTO
 * - Entity를 직접 노출하지 않고 DTO로 변환하여 API 계약 안정성 확보
 */
export class ProductResponseDto {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stock: number;
  createdAt: Date;

  static from(product: {
    id: string;
    name: string;
    description: string | null;
    price: number;
    stock: number;
    createdAt: Date;
  }): ProductResponseDto {
    const dto = new ProductResponseDto();
    dto.id = product.id;
    dto.name = product.name;
    dto.description = product.description;
    dto.price = product.price;
    dto.stock = product.stock;
    dto.createdAt = product.createdAt;
    return dto;
  }
}
