import { UserRole } from '@/database/generated/prisma/enums';
import { SetMetadata } from '@nestjs/common';

export const ROLE_KEY = 'ROLES';

export function Roles(...roles: UserRole[]) {
  return SetMetadata(ROLE_KEY, roles);
}
