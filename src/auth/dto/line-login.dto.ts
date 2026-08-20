import { IsNotEmpty, IsString } from 'class-validator';

export class LineLoginDto {
  @IsString()
  @IsNotEmpty()
  code: string;

  @IsString()
  @IsNotEmpty()
  redirectUri: string;
}
