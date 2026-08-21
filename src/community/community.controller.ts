import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';

import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';

import { CommunityService } from './community.service';
import { CreateCommunityPostDto } from './dto/create-community-post.dto';
import { UpdateCommunityPostDto } from './dto/update-community-post.dto';
import { CommunityPostQueryDto } from './dto/community-post-query.dto';

@Controller('community')
export class CommunityController {
  constructor(private readonly communityService: CommunityService) {}

  @Post('posts')
  createPost(
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateCommunityPostDto,
  ) {
    return this.communityService.createPost(userId, dto);
  }

  @Public()
  @Get('posts')
  listPosts(@Query() query: CommunityPostQueryDto) {
    return this.communityService.listPosts(query);
  }

  @Public()
  @Get('posts/:id')
  getPostDetail(@Param('id', ParseUUIDPipe) postId: string) {
    return this.communityService.getPostDetail(postId);
  }

  @Patch('posts/:id')
  updatePost(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Body() dto: UpdateCommunityPostDto,
  ) {
    return this.communityService.updatePost(userId, postId, dto);
  }

  @Delete('posts/:id')
  deletePost(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
  ) {
    return this.communityService.deletePost(userId, postId);
  }

  @Post('posts/:id/images')
  @UseInterceptors(FilesInterceptor('images', 3))
  addPostImages(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.communityService.addPostImages(userId, postId, files);
  }

  @Delete('posts/:id/images/:imageId')
  deletePostImage(
    @CurrentUser('sub') userId: string,
    @Param('id', ParseUUIDPipe) postId: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.communityService.deletePostImage(userId, postId, imageId);
  }
}
