import { Module } from '@nestjs/common';
import { PaymentController } from './payment.controller';
import { PaymentService } from './payment.service';
import { PaymentGatewayService } from './payment-gateway.service';
import { OrderModule } from '../order/order.module';

/**
 * DI 구조 비교:
 * - Spring: @Autowired로 다른 패키지의 @Service를 바로 주입 가능 (ComponentScan 범위 내)
 * - NestJS: 다른 모듈의 Provider를 쓰려면 해당 모듈을 imports에 등록해야 함
 *           + 해당 모듈이 exports에 Provider를 노출해야 함
 *
 * OrderModule.exports에 OrderService가 있으므로 여기서 주입 가능
 */
@Module({
  imports: [OrderModule],
  controllers: [PaymentController],
  providers: [PaymentService, PaymentGatewayService],
  exports: [PaymentService],
})
export class PaymentModule {}
