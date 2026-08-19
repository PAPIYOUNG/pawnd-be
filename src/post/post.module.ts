import { Module } from '@nestjs/common';
import { PostService } from './post.service';
import { PostController } from './post.controller';
import { UploadModule } from '@/infrastructure/upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [PostController],
  providers: [PostService],
})
export class PostModule {}
