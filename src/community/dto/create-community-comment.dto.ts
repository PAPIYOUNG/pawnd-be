import { IsNotEmpty, IsString } from 'class-validator';

export class CreateCommunityCommentDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsNotEmpty()
  imageUrl!: string;
}
