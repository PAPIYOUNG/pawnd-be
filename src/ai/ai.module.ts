import { Module } from '@nestjs/common';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { OpenRouterProvider } from '@/ai/providers/openrouter.provider';
import { AiLogService } from '@/ai/service/ai-log.service';
import { AiMatchingService } from '@/ai/ai-matching.service';
import { EmbeddingService } from '@/ai/service/embedding.service';
import { PetAvatarService } from '@/ai/service/pet-avatar.service';
import { DatabaseModule } from '@/database/database.module';
import { UploadModule } from '@/infrastructure/upload/upload.module';
import { PostEventsModule } from '@/post-events/post-events.module';

@Module({
  imports: [DatabaseModule, UploadModule, PostEventsModule],
  controllers: [AiController],
  providers: [
    AiService,
    OpenRouterProvider,
    AiLogService,
    AiMatchingService,
    EmbeddingService,
    PetAvatarService,
  ],
  exports: [
    AiService,
    AiLogService,
    AiMatchingService,
    EmbeddingService,
    PetAvatarService,
  ],
})
export class AiModule {}
