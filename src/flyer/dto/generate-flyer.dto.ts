import { IsEnum, IsOptional } from 'class-validator';

export enum FlyerTemplate {
  STANDARD = 'STANDARD',
  REWARD_EMPHASIS = 'REWARD_EMPHASIS',
}

export class GenerateFlyerDto {
  @IsOptional()
  @IsEnum(FlyerTemplate)
  template?: FlyerTemplate = FlyerTemplate.STANDARD;
}
