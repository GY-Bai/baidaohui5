import { Module } from '@nestjs/common';
import { AiProxyController } from './ai-proxy.controller';
import { AiProxyService } from './ai-proxy.service';
import { OpenRouterService } from './providers/openrouter.service';
import { GeminiService } from './providers/gemini.service';
import { SuanliService } from './providers/suanli.service';
import { RateLimitService } from './rate-limit.service';

@Module({
  controllers: [AiProxyController],
  providers: [
    AiProxyService,
    OpenRouterService,
    GeminiService,
    SuanliService,
    RateLimitService,
  ],
  exports: [AiProxyService],
})
export class AiProxyModule {} 