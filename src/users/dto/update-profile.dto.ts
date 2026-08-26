import { Trim } from '@/common/decorators/trim.decorator';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Trim()
  firstName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Trim()
  lastName?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  lineId?: string;
}
