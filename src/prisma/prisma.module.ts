import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/**
 * @Global 데코레이터로 전역 모듈 등록
 * - 모든 모듈에서 PrismaService를 import 없이 주입 가능
 */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
