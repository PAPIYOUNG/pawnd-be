import { AiLogInput } from '@/ai/types/ai-log.types';
import { ai_generation_logs } from '@/database/generated/prisma/client';
import { PrismaService } from '@/database/prisma.service';
import { Injectable } from '@nestjs/common';

@Injectable()
export class AiLogService {
  constructor(private readonly prisma: PrismaService) {}

  async createAiLog(input: AiLogInput): Promise<ai_generation_logs> {
    return this.prisma.ai_generation_logs.create({
      data: {
        feature: input.feature,

        requested_model: input.requestedModel,
        resolved_model: input.resolvedModel,

        provider: input.provider ?? null,
        generation_id: input.generationId ?? null,

        input_tokens: input.inputTokens ?? null,
        output_tokens: input.outputTokens ?? null,
        total_tokens: input.totalTokens ?? null,

        cost_usd: input.costUsd ?? null,

        fallback_used: input.fallbackUsed ?? false,

        finish_reason: input.finishReason ?? null,
        streaming: input.streaming ?? false,

        success: input.success ?? true,

        error_code: input.errorCode ?? null,
        error_message: input.errorMessage ?? null,
      },
    });
  }
}
