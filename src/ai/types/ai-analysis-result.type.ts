import { PetType } from '@/database/generated/prisma/enums';

export type AiAnalysisResult = {
  type: PetType;
  breed: string | null;
  color: string | null;
  distinctiveFeatures: string | null;
  description: string | null;
};
