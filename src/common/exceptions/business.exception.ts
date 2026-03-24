import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 비즈니스 로직 위반 시 사용하는 커스텀 예외
 * - HTTP 상태 코드와 별개로 비즈니스 에러 코드를 전달하여
 *   클라이언트가 에러 유형을 프로그래밍적으로 구분할 수 있게 함
 */
export class BusinessException extends HttpException {
  constructor(
    public readonly errorCode: string,
    message: string,
    statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ errorCode, message, statusCode }, statusCode);
  }
}
