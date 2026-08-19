import { PartialType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional } from 'class-validator';
import { PostStatus } from '@/database/generated/prisma/enums';
import { CreatePostDto } from './create-post.dto';

export class UpdatePostDto extends PartialType(CreatePostDto) {
  @IsOptional()
  @IsEnum(PostStatus)
  status?: PostStatus;
}
