import { PartialType } from '@nestjs/mapped-types';
import { CreateCommunityCommentDto } from './create-community-comment.dto';

export class UpdateCommunityCommentDto extends PartialType(
  CreateCommunityCommentDto,
) {}
