import { Controller, Post, Get, Param, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { PaymentService } from './payment.service';
import { ProcessPaymentDto } from './dto/process-payment.dto';
import { ApiResponse } from '../common';
import { PaymentResponseDto } from './dto/payment-response.dto';

@Controller('payments')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async processPayment(
    @Body() dto: ProcessPaymentDto,
  ): Promise<ApiResponse<PaymentResponseDto>> {
    const payment = await this.paymentService.processPayment(dto);
    return ApiResponse.of(payment);
  }

  @Get('order/:orderId')
  async findByOrderId(
    @Param('orderId') orderId: string,
  ): Promise<ApiResponse<PaymentResponseDto[]>> {
    const payments = await this.paymentService.findByOrderId(orderId);
    return ApiResponse.of(payments);
  }
}
