import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @IsString()
  @IsOptional()
  password?: string;

  @IsString()
  @IsOptional()
  confirmEmail?: string;
}
