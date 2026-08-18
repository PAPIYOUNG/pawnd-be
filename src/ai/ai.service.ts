import { OpenRouterProvider } from '@/ai/providers/openrouter.provider';
import { AiLogService } from '@/ai/service/ai-log.service';
import { OpenRouterChatCompletion } from '@/ai/types/openrouter.type';
import { ai_feature } from '@/database/generated/prisma/enums';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AiService {
  constructor(
    private readonly openRouterProvider: OpenRouterProvider,
    private readonly configService: ConfigService,
    private readonly aiLogService: AiLogService,
  ) {}

  async testConnection() {
    const client = this.openRouterProvider.getClient();

    const requestedModel = this.configService.getOrThrow<string>(
      'AI_ANALYZE_IMAGE_MODEL',
    );

    try {
      const response = (await client.chat.completions.create({
        model: requestedModel,
        messages: [
          {
            role: 'user',
            content: 'Reply with PAWND AI READY',
          },
        ],
        max_tokens: 50,
      })) as OpenRouterChatCompletion;

      await this.callCreateAiLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        response,
      );

      return response.choices[0]?.message.content;
    } catch (error: unknown) {
      await this.callCreateAiErrorLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        error,
      );

      throw error;
    }
  }

  //ส่วนย่อย ai log
  private async callCreateAiLog(
    feature: ai_feature,
    requestedModel: string,
    response: OpenRouterChatCompletion,
  ): Promise<void> {
    const resolvedModel = response.model ?? requestedModel;

    await this.aiLogService.createAiLog({
      feature,

      requestedModel,
      resolvedModel,

      provider: response.provider ?? null,
      generationId: response.id ?? null,

      inputTokens: response.usage?.prompt_tokens ?? null,
      outputTokens: response.usage?.completion_tokens ?? null,
      totalTokens: response.usage?.total_tokens ?? null,

      costUsd: response.usage?.cost ?? null,

      fallbackUsed: requestedModel !== resolvedModel,

      finishReason: response.choices[0]?.finish_reason ?? null,

      streaming: false,
      success: true,
    });
  }

  private async callCreateAiErrorLog(
    feature: ai_feature,
    requestedModel: string,
    error: unknown,
  ): Promise<void> {
    const errorCode =
      error instanceof Error && 'status' in error ? String(error.status) : null;

    const errorMessage =
      error instanceof Error ? error.message : 'Unknown AI error';

    await this.aiLogService.createAiLog({
      feature,

      requestedModel,
      resolvedModel: requestedModel,

      provider: null,
      generationId: null,

      fallbackUsed: false,

      streaming: false,
      success: false,

      errorCode,
      errorMessage,
    });
  }
}
