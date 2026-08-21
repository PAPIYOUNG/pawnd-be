import { IsEnum } from 'class-validator';
import { UserStatus } from '@/database/generated/prisma/enums';

export class UpdateUserStatusDto {
  @IsEnum(UserStatus)
  status: UserStatus;
}
