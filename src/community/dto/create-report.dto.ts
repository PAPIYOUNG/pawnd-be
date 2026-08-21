import { ReportType } from '@/database/generated/prisma/enums';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateReportDto {
  @IsEnum(ReportType)
  reportType!: ReportType;

  @IsOptional()
  @IsUUID()
  communityPostId?: string;

  @IsOptional()
  @IsUUID()
  commentId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
