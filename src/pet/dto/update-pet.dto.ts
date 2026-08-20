import { Trim } from '@/common/decorators/trim.decorator';
import { PetGender, PetType } from '@/database/generated/prisma/enums';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePetDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Trim()
  name?: string;

  @IsOptional()
  @IsEnum(PetType)
  type?: PetType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Trim()
  breed?: string;

  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  @Trim()
  color?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  age?: number;

  @IsOptional()
  @IsString()
  @Trim()
  distinctiveFeatures?: string;

  @IsOptional()
  @IsString()
  @Trim()
  description?: string;
}
