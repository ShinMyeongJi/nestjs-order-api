/**
 * 통일된 API 응답 래퍼
 * - 모든 성공 응답을 일관된 구조로 감싸서 클라이언트 파싱 단순화
 */
export class ApiResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;

  constructor(data: T) {
    this.success = true;
    this.data = data;
    this.timestamp = new Date().toISOString();
  }

  static of<T>(data: T): ApiResponse<T> {
    return new ApiResponse(data);
  }
}
