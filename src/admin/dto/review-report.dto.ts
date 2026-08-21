import { IsBoolean, IsEnum, IsOptional } from 'class-validator';
import { ReportStatus } from '@/database/generated/prisma/enums';

export class ReviewReportDto {
  @IsEnum(ReportStatus)
  status: ReportStatus;

  @IsOptional()
  @IsBoolean()
  hideContent?: boolean;
}
