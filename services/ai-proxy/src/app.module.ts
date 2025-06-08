import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AiProxyModule } from './ai-proxy/ai-proxy.module';
import { HealthModule } from '../common/src/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 1分钟
        limit: 10, // 每分钟最多10次请求
      },
    ]),
    AiProxyModule,
    HealthModule,
  ],
})
export class AppModule {} 