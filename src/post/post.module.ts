import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { UploadModule } from '@/infrastructure/upload/upload.module';
import { FlyerModule } from '@/flyer/flyer.module';
import { AiModule } from '@/ai/ai.module';
import { PostEventsModule } from '@/post-events/post-events.module';

@Module({
  // ทำให้ PostService ใช้ตัวบันทึก timeline ได้โดยตรง
  imports: [UploadModule, FlyerModule, AiModule, PostEventsModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
