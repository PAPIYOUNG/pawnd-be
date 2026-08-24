import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { UploadModule } from '@/infrastructure/upload/upload.module';
import { FlyerModule } from '@/flyer/flyer.module';
import { AiModule } from '@/ai/ai.module';

@Module({
  imports: [UploadModule, FlyerModule, AiModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
