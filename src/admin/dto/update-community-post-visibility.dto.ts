import { IsBoolean } from 'class-validator';

export class UpdateCommunityPostVisibilityDto {
  @IsBoolean()
  isHidden: boolean;
}
