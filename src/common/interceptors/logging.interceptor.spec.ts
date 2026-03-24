import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

describe('LoggingInterceptor', () => {
  let interceptor: LoggingInterceptor;

  beforeEach(() => {
    interceptor = new LoggingInterceptor();
  });

  it('should log request method and url', (done) => {
    const mockContext = {
      switchToHttp: () => ({
        getRequest: () => ({ method: 'GET', url: '/api/v1/products' }),
      }),
    } as unknown as ExecutionContext;

    const mockHandler: CallHandler = {
      handle: () => of({ data: 'test' }),
    };

    const logSpy = jest.spyOn(interceptor['logger'], 'log');

    interceptor.intercept(mockContext, mockHandler).subscribe({
      complete: () => {
        expect(logSpy).toHaveBeenCalledWith(
          expect.stringContaining('GET /api/v1/products'),
        );
        done();
      },
    });
  });
});
