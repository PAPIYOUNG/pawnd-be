import { IsNotEmpty, IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  oldPassword: string;

  @MinLength(8)
  @IsString()
  @IsNotEmpty()
  newPassword: string;
}
