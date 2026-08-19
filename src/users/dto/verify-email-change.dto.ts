import { IsNotEmpty, IsString } from 'class-validator';

export class VerifyEmailChangeDto {
  @IsString()
  @IsNotEmpty()
  otp: string;
}
