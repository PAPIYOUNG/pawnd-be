import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterProvider } from '@/ai/providers/openrouter.provider';
import { AiLogService } from '@/ai/service/ai-log.service';
import { AiMatchingService } from '@/ai/ai-matching.service';
import { EmbeddingService } from '@/ai/service/embedding.service';

@Module({
  controllers: [AiController],
  providers: [
    AiService,
    OpenRouterProvider,
    AiLogService,
    AiMatchingService,
    EmbeddingService,
  ],
  exports: [AiService, AiLogService, AiMatchingService, EmbeddingService],
})
export class AiModule {}
