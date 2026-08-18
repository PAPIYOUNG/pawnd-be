import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterProvider } from '@/ai/providers/openrouter.provider';
import { AiLogService } from '@/ai/service/ai-log.service';

@Module({
  controllers: [AiController],
  providers: [AiService, OpenRouterProvider, AiLogService],
  exports: [AiService, AiLogService],
})
export class AiModule {}
