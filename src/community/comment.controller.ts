import {
  Body,
  Controller,
  Delete,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';

import { CurrentUser } from '@/common/decorators/current-user.decorator';

import { CommentService } from './comment.service';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { UpdateCommunityCommentDto } from './dto/update-community-comment.dto';

@Controller('community')
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post('posts/:id/comments')
  addComment(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: CreateCommunityCommentDto,
  ) {
    return this.commentService.addComment(userId, postId, dto);
  }

  @Patch('comments/:id')
  updateComment(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
    @Body() dto: UpdateCommunityCommentDto,
  ) {
    return this.commentService.updateComment(userId, commentId, dto);
  }

  @Delete('comments/:id')
  deleteComment(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) commentId: string,
  ) {
    return this.commentService.deleteComment(userId, commentId);
  }
}
