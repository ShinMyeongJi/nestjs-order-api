import { Injectable, Logger, HttpStatus } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { BusinessException, ErrorCodes } from '../common';

/**
 * Mock 결제 게이트웨이
 * - 실제 PG사 연동을 시뮬레이션
 * - NestJS의 DI 토큰 기반으로 실제 PG 구현체로 교체 가능
 *   (Module의 providers에서 PaymentGatewayService를 다른 클래스로 교체)
 * - 90% 확률로 성공, 10% 확률로 실패 (실제 환경 시뮬레이션)
 */
export interface PaymentGatewayResult {
  success: boolean;
  transactionId: string | null;
  failureReason: string | null;
}

@Injectable()
export class PaymentGatewayService {
  private readonly logger = new Logger(PaymentGatewayService.name);

  async processPayment(
    orderId: string,
    amount: number,
  ): Promise<PaymentGatewayResult> {
    this.logger.log(
      `Processing payment for order ${orderId}, amount: ${amount}`,
    );

    try {
      // 실제 PG 연동 시뮬레이션 (네트워크 지연)
      await this.simulateNetworkDelay();

      // 90% 성공률 시뮬레이션
      const isSuccess = Math.random() > 0.1;

      if (isSuccess) {
        return {
          success: true,
          transactionId: `TXN-${uuidv4()}`,
          failureReason: null,
        };
      }

      return {
        success: false,
        transactionId: null,
        failureReason: 'Payment declined by issuer',
      };
    } catch (error) {
      // PG 게이트웨이 통신 장애 — 우리 서버 버그(500)와 구분하기 위해 502로 분리
      this.logger.error(
        `Payment gateway communication error for order ${orderId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new BusinessException(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
        'Payment gateway is temporarily unavailable. Please retry later.',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private simulateNetworkDelay(): Promise<void> {
    const delay = Math.floor(Math.random() * 200) + 100;
    return new Promise((resolve) => setTimeout(resolve, delay));
  }
}
