import { IsEmail, IsNotEmpty, IsString } from 'class-validator';

export class CompleteLineDto {
  @IsString()
  @IsNotEmpty()
  tempToken: string;

  @IsEmail()
  @IsNotEmpty()
  @IsString()
  email: string;
}
