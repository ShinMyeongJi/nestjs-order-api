import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { ApiResponse } from '../common';
import { OrderResponseDto } from './dto/order-response.dto';

@Controller('orders')
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() dto: CreateOrderDto,
  ): Promise<ApiResponse<OrderResponseDto>> {
    const order = await this.orderService.createOrder(dto);
    return ApiResponse.of(order);
  }

  @Get(':id')
  async findById(
    @Param('id') id: string,
  ): Promise<ApiResponse<OrderResponseDto>> {
    const order = await this.orderService.findById(id);
    return ApiResponse.of(order);
  }

  @Get()
  async findAll(): Promise<ApiResponse<OrderResponseDto[]>> {
    const orders = await this.orderService.findAll();
    return ApiResponse.of(orders);
  }
}
