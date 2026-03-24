import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { BusinessException } from '../exceptions/business.exception';

/**
 * 전역 예외 필터
 * - BusinessException: 비즈니스 에러 코드를 포함한 구조화된 응답
 * - HttpException: NestJS 기본 HTTP 예외 처리
 * - Unknown: 예상치 못한 에러를 500으로 래핑하여 내부 정보 노출 방지
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let errorResponse: Record<string, unknown>;

    if (exception instanceof BusinessException) {
      status = exception.getStatus();
      errorResponse = {
        success: false,
        errorCode: exception.errorCode,
        message: exception.message,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      errorResponse = {
        success: false,
        errorCode: 'HTTP_ERROR',
        message:
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : (exceptionResponse as Record<string, unknown>).message ||
              exception.message,
        timestamp: new Date().toISOString(),
        path: request.url,
      };
    } else {
      // 예상치 못한 에러 - 내부 정보 노출 방지
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      errorResponse = {
        success: false,
        errorCode: 'INTERNAL_ERROR',
        message: 'An unexpected error occurred',
        timestamp: new Date().toISOString(),
        path: request.url,
      };
      this.logger.error(
        `Unhandled exception: ${exception}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    }

    response.status(status).json(errorResponse);
  }
}
