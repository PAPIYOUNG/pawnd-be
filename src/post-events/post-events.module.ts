import { Module } from '@nestjs/common';
import { PostEventsController } from './post-events.controller';
import { PostEventsService } from './post-events.service';

@Module({
  controllers: [PostEventsController],
  providers: [PostEventsService],
  exports: [PostEventsService],
})
export class PostEventsModule {}
