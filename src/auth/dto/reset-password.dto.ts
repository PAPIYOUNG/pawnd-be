import { Match } from '@/common/decorators/match.decorator';
import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @MinLength(8)
  @IsString()
  @IsNotEmpty()
  newPassword: string;

  @IsString()
  @IsNotEmpty()
  @Match('newPassword', { message: 'confirmPassword must match newPassword' })
  confirmPassword: string;
}
