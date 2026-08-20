import { ai_feature } from '@/database/generated/prisma/enums';

export type AiLogInput = {
  feature: ai_feature;

  requestedModel: string;
  resolvedModel: string;

  provider?: string | null;
  generationId?: string | null;

  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;

  costUsd?: number | null;

  fallbackUsed?: boolean;

  finishReason?: string | null;
  streaming?: boolean;

  success?: boolean;

  errorCode?: string | null;
  errorMessage?: string | null;
};
