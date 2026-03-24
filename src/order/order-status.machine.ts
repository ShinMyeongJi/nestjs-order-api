import { OrderStatus } from '@prisma/client';
import { BusinessException, ErrorCodes } from '../common';
import { HttpStatus } from '@nestjs/common';

/**
 * 주문 상태 머신 (State Machine)
 *
 * Spring의 StateMachine과 동일한 역할 — 허용된 상태 전이만 통과시키고
 * 비논리적 전이(예: PENDING → SHIPPED)를 컴파일 타임이 아닌 런타임에서 차단.
 *
 * 전이 규칙:
 *   PENDING   → COMPLETED (결제 성공)
 *   PENDING   → FAILED    (결제 실패)
 *   PENDING   → CANCELLED (사용자 취소)
 *   FAILED    → PENDING   (재시도 허용)
 *   COMPLETED → SHIPPED   (배송 시작 - 향후 확장)
 *   SHIPPED   → DELIVERED (배송 완료 - 향후 확장)
 *
 * 허용되지 않은 전이 시도 시 BusinessException을 던져서
 * 서비스 레이어가 상태 검증 로직을 직접 갖지 않도록 분리.
 */

// 각 상태에서 전이 가능한 다음 상태 목록
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['COMPLETED', 'FAILED', 'CANCELLED'],
  COMPLETED: [],   // 향후 SHIPPED 추가 시 여기에 등록
  FAILED: ['PENDING'],  // 결제 재시도를 위해 PENDING 복귀 허용
  CANCELLED: [],        // 최종 상태 — 더 이상 전이 불가
};

export class OrderStatusMachine {
  /**
   * 상태 전이 가능 여부를 검증하고, 불가능하면 예외를 던짐
   * - Spring의 StateMachineInterceptor와 유사한 역할
   */
  static validateTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): void {
    const allowed = ALLOWED_TRANSITIONS[currentStatus];

    if (!allowed || !allowed.includes(nextStatus)) {
      throw new BusinessException(
        ErrorCodes.INVALID_ORDER_STATUS,
        `Invalid status transition: ${currentStatus} → ${nextStatus}. ` +
          `Allowed transitions from ${currentStatus}: [${allowed?.join(', ') || 'none'}]`,
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  /**
   * 전이 가능 여부만 boolean으로 반환 (예외 없이 체크만 필요할 때)
   */
  static canTransition(
    currentStatus: OrderStatus,
    nextStatus: OrderStatus,
  ): boolean {
    const allowed = ALLOWED_TRANSITIONS[currentStatus];
    return allowed?.includes(nextStatus) ?? false;
  }
}
