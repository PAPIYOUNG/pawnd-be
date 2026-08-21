import { IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PostType } from '@/database/generated/prisma/enums';

export class GetLatestPostsDto {
  @IsOptional()
  @IsEnum(PostType, {
    message: 'type must be either LOST or FOUND',
  })
  type?: PostType;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;
}
