import { OrderStatus } from '@prisma/client';
import { OrderStatusMachine } from './order-status.machine';
import { BusinessException } from '../common';
import { ErrorCodes } from '../common/exceptions/error-codes';

describe('OrderStatusMachine', () => {
  describe('validateTransition', () => {
    // 허용된 전이
    it.each([
      ['PENDING', 'COMPLETED'],
      ['PENDING', 'FAILED'],
      ['PENDING', 'CANCELLED'],
      ['FAILED', 'PENDING'],
    ] as [OrderStatus, OrderStatus][])(
      'should allow %s → %s',
      (from, to) => {
        expect(() =>
          OrderStatusMachine.validateTransition(from, to),
        ).not.toThrow();
      },
    );

    // 금지된 전이 — 비논리적 상태 점프 차단
    it.each([
      ['PENDING', 'PENDING'],     // 자기 자신으로 전이 불가
      ['COMPLETED', 'PENDING'],   // 완료 후 되돌리기 불가
      ['COMPLETED', 'FAILED'],    // 완료 후 실패 불가
      ['COMPLETED', 'CANCELLED'], // 완료 후 취소 불가
      ['CANCELLED', 'PENDING'],   // 취소 후 복구 불가
      ['CANCELLED', 'COMPLETED'], // 취소 후 완료 불가
      ['FAILED', 'COMPLETED'],    // 실패에서 바로 완료 불가 (PENDING 거쳐야 함)
      ['FAILED', 'CANCELLED'],    // 실패에서 취소 불가
    ] as [OrderStatus, OrderStatus][])(
      'should reject %s → %s',
      (from, to) => {
        expect(() =>
          OrderStatusMachine.validateTransition(from, to),
        ).toThrow(BusinessException);

        try {
          OrderStatusMachine.validateTransition(from, to);
        } catch (error) {
          expect((error as BusinessException).errorCode).toBe(
            ErrorCodes.INVALID_ORDER_STATUS,
          );
          // 에러 메시지에 현재 상태와 시도한 상태가 포함되는지 확인
          expect((error as BusinessException).message).toContain(from);
          expect((error as BusinessException).message).toContain(to);
        }
      },
    );
  });

  describe('canTransition', () => {
    it('should return true for allowed transitions', () => {
      expect(OrderStatusMachine.canTransition('PENDING', 'COMPLETED')).toBe(true);
      expect(OrderStatusMachine.canTransition('FAILED', 'PENDING')).toBe(true);
    });

    it('should return false for disallowed transitions', () => {
      expect(OrderStatusMachine.canTransition('COMPLETED', 'PENDING')).toBe(false);
      expect(OrderStatusMachine.canTransition('CANCELLED', 'COMPLETED')).toBe(false);
    });
  });
});
