import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request } from 'express';

/**
 * 요청/응답 로깅 인터셉터
 * - 모든 HTTP 요청의 메서드, URL, 처리 시간을 기록
 * - 운영 환경에서 성능 모니터링 및 디버깅에 활용
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url } = request;
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const elapsed = Date.now() - startTime;
        this.logger.log(`${method} ${url} - ${elapsed}ms`);
      }),
    );
  }
}
