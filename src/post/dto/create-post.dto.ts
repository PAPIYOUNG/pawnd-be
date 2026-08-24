import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PetGender,
  PetType,
  PostType,
} from '@/database/generated/prisma/enums';

export class CreatePostDto {
  @IsOptional()
  @IsUUID()
  petId?: string;

  @IsEnum(PostType)
  type!: PostType;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  petName?: string;

  @IsEnum(PetType)
  petType!: PetType;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  breed?: string;

  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  color?: string;

  @IsOptional()
  @IsString()
  distinctiveFeatures?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  eventDate!: string;

  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  province?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  district?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  subdistrict?: string;

  @IsOptional()
  @IsString()
  locationDescription?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  rewardAmount?: number;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  @IsOptional()
  @IsString()
  contactPhone?: string;

  @IsOptional()
  @IsString()
  contactLineId?: string;

  @IsOptional()
  @IsEmail()
  contactEmail?: string;
}
