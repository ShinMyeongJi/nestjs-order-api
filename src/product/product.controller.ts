import { Controller, Get, Param } from '@nestjs/common';
import { ProductService } from './product.service';
import { ApiResponse } from '../common';
import { ProductResponseDto } from './dto/product-response.dto';

@Controller('products')
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Get()
  async findAll(): Promise<ApiResponse<ProductResponseDto[]>> {
    const products = await this.productService.findAll();
    return ApiResponse.of(products);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponse<ProductResponseDto>> {
    const product = await this.productService.findById(id);
    return ApiResponse.of(product);
  }
}
