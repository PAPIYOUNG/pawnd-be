import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @IsString()
  @IsNotEmpty()
  otp: string;
}
