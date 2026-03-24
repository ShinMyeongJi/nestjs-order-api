import { PaymentGatewayService } from './payment-gateway.service';
import { BusinessException } from '../common';
import { ErrorCodes } from '../common/exceptions/error-codes';
import { HttpStatus } from '@nestjs/common';

describe('PaymentGatewayService', () => {
  let service: PaymentGatewayService;

  beforeEach(() => {
    service = new PaymentGatewayService();
  });

  it('should return success result with transactionId', async () => {
    // Math.random을 고정하여 성공 케이스 보장 (0.5 > 0.1 = true)
    jest.spyOn(Math, 'random').mockReturnValue(0.5);

    const result = await service.processPayment('order-1', 30000);

    expect(result.success).toBe(true);
    expect(result.transactionId).toMatch(/^TXN-/);
    expect(result.failureReason).toBeNull();

    jest.restoreAllMocks();
  });

  it('should return failure result when random < 0.1', async () => {
    // Math.random을 고정하여 실패 케이스 보장 (0.05 > 0.1 = false)
    jest.spyOn(Math, 'random').mockReturnValue(0.05);

    const result = await service.processPayment('order-1', 30000);

    expect(result.success).toBe(false);
    expect(result.transactionId).toBeNull();
    expect(result.failureReason).toBe('Payment declined by issuer');

    jest.restoreAllMocks();
  });

  it('should throw PAYMENT_GATEWAY_ERROR (502) on network failure', async () => {
    // simulateNetworkDelay를 에러로 오버라이드하여 네트워크 장애 시뮬레이션
    jest
      .spyOn(service as any, 'simulateNetworkDelay')
      .mockRejectedValue(new Error('ECONNREFUSED'));

    try {
      await service.processPayment('order-1', 30000);
      fail('Should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(BusinessException);
      expect((error as BusinessException).errorCode).toBe(
        ErrorCodes.PAYMENT_GATEWAY_ERROR,
      );
      expect((error as BusinessException).getStatus()).toBe(
        HttpStatus.BAD_GATEWAY,
      );
    }
  });
});
