/**
 * 비즈니스 에러 코드 상수
 * - 클라이언트가 에러 유형을 식별하는 데 사용
 * - 도메인별로 접두사를 구분하여 추적 용이성 확보
 */
export const ErrorCodes = {
  // Product 도메인
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  INSUFFICIENT_STOCK: 'INSUFFICIENT_STOCK',

  // Order 도메인
  ORDER_NOT_FOUND: 'ORDER_NOT_FOUND',
  INVALID_ORDER_STATUS: 'INVALID_ORDER_STATUS',

  // Payment 도메인
  PAYMENT_ALREADY_PROCESSED: 'PAYMENT_ALREADY_PROCESSED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  PAYMENT_GATEWAY_ERROR: 'PAYMENT_GATEWAY_ERROR',
  ORDER_ALREADY_PAID: 'ORDER_ALREADY_PAID',
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];
