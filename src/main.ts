import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const logger = new Logger('Bootstrap');

  // 전역 파이프 - DTO 유효성 검증 자동화
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의되지 않은 속성 자동 제거
      forbidNonWhitelisted: true, // 정의되지 않은 속성 전송 시 에러
      transform: true, // 요청 데이터를 DTO 인스턴스로 자동 변환
    }),
  );

  // 전역 예외 필터
  app.useGlobalFilters(new GlobalExceptionFilter());

  // 전역 로깅 인터셉터
  app.useGlobalInterceptors(new LoggingInterceptor());

  // API 접두사 설정
  app.setGlobalPrefix('api/v1');

  const port = process.env.PORT || 3000;
  await app.listen(port);
  logger.log(`Application running on port ${port}`);
}

bootstrap();
