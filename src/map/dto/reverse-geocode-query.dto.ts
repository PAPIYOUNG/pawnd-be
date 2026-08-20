import { Transform } from 'class-transformer';
import { IsIn, IsNumber, IsOptional, Max, Min } from 'class-validator';

export type ReverseGeocodeLanguage = 'th' | 'en';

const toRequiredNumber = (value: unknown): number =>
  typeof value === 'string' && value.trim() === '' ? Number.NaN : Number(value);

export class ReverseGeocodeQueryDto {
  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-90)
  @Max(90)
  latitude: number;

  @Transform(({ value }) => toRequiredNumber(value))
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsOptional()
  @IsIn(['th', 'en'])
  language: ReverseGeocodeLanguage = 'th';
}
