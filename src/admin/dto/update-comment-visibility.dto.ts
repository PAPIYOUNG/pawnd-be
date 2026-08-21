import { IsBoolean } from 'class-validator';

export class UpdateCommentVisibilityDto {
  @IsBoolean()
  isHidden: boolean;
}
