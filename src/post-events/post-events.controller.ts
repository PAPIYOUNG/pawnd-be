import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';

import { Public } from '../common/decorators/public.decorator';
import { PostEventsService } from './post-events.service';

@Controller('posts')
export class PostEventsController {
  constructor(private readonly postEventsService: PostEventsService) {}

  @Public()
  @Get(':postId/events')
  getPostEvents(@Param('postId', ParseUUIDPipe) postId: string) {
    return this.postEventsService.getPostEvents(postId);
  }
}
