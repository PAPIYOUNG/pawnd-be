import { IsString } from 'class-validator';

export class AnalyzeImageDto {
  @IsString()
  imageUrl: string;
}
