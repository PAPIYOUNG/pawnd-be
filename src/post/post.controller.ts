import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { PostService } from './post.service';
import { CreatePostDto } from '@/post/dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Public } from '@/common/decorators/public.decorator';
import { PostQueryDto, SearchPostsDto } from '@/post/dto/post-query.dto';
import { FilesInterceptor } from '@nestjs/platform-express';

@Controller('posts')
export class PostController {
  constructor(private readonly postService: PostService) {}

  @Post()
  createPost(
    @CurrentUser('sub') userId: string,
    @Body() createPostDto: CreatePostDto,
  ) {
    return this.postService.createPost(userId, createPostDto);
  }

  @Get('me')
  getMyPosts(@CurrentUser('sub') userId: string, @Query() query: PostQueryDto) {
    return this.postService.getMyPosts(userId, query);
  }

  @Public()
  @Get('search')
  searchPosts(@Query() query: SearchPostsDto) {
    return this.postService.searchPosts(query);
  }

  @Public()
  @Get('stats')
  getPostStats() {
    return this.postService.getPostStats();
  }

  @Public()
  @Get()
  getAllPosts(@Query() query: PostQueryDto) {
    return this.postService.getAllPosts(query);
  }

  @Public()
  @Get(':id')
  getPostById(@Param('id', ParseUUIDPipe) id: string) {
    return this.postService.getPostById(id);
  }

  @Patch(':id')
  updateOrChangeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @Body() updatePostDto: UpdatePostDto,
  ) {
    const { status, ...postInformation } = updatePostDto;

    if (status !== undefined) {
      if (Object.keys(postInformation).length > 0) {
        throw new BadRequestException(
          'Send status alone when changing post status',
        );
      }

      return this.postService.changeStatus(id, userId, status);
    }

    return this.postService.updatePost(id, userId, updatePostDto);
  }

  @Delete(':id/images/:imageId')
  deletePostImage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postService.deletePostImage(id, imageId, userId);
  }

  @Post(':id/images')
  @UseInterceptors(FilesInterceptor('images', 10))
  uploadPostImages(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    return this.postService.uploadPostImages(id, userId, files);
  }

  @Delete(':id')
  deletePost(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('sub') userId: string,
  ) {
    return this.postService.deletePost(id, userId);
  }
}
