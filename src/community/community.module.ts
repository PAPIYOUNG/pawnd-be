import { Module } from '@nestjs/common';

import { DatabaseModule } from '@/database/database.module';
import { UploadModule } from '@/infrastructure/upload/upload.module';

import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [DatabaseModule, UploadModule],
  controllers: [CommunityController, CommentController, ReportController],
  providers: [CommunityService, CommentService, ReportService],
  exports: [CommunityService, CommentService, ReportService],
})
export class CommunityModule {}
