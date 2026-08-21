import { IsEnum } from 'class-validator';
import { PostStatus } from '@/database/generated/prisma/enums';

export class UpdatePostStatusDto {
  @IsEnum(PostStatus)
  status: PostStatus;
}
