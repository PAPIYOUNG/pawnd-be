import { OpenRouterProvider } from '@/ai/providers/openrouter.provider';
import { AiLogService } from '@/ai/service/ai-log.service';
import { AiAnalysisResult } from '@/ai/types/ai-analysis-result.type';
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

      await this.createAiSuccessLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        response,
      );

      return response.choices[0]?.message.content;
    } catch (error: unknown) {
      await this.createAiErrorLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        error,
      );

      throw error;
    }
  }
  async analyzeImage(imageUrl: string): Promise<AiAnalysisResult> {
    const client = this.openRouterProvider.getClient();

    const requestedModel = this.configService.getOrThrow<string>(
      'AI_ANALYZE_IMAGE_MODEL',
    );

    try {
      const response = (await client.chat.completions.create({
        model: requestedModel,

        messages: [
          {
            role: 'system',
            content: `
You are an AI image analysis assistant for PAWND, a lost and found pet platform.

Analyze the pet using only information that is visually observable in the provided image.

Rules:
- Do not guess or invent information.
- Classify the pet type as DOG, CAT, BIRD, HAMSTER, EXOTIC, or OTHER.
- If the pet type cannot be reliably classified into the supported categories, use OTHER.
- Do not infer gender, age, name, owner information, or other non-visible information.
- For optional attributes that cannot be reliably determined from the image, return null.
- Keep descriptions factual, concise, and useful for identifying a lost or found pet.
- Focus on visible characteristics that can help distinguish the pet from others.
  `.trim(),
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'Analyze this pet image and return the pet attributes.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],

        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'pet_image_analysis',
            strict: true,

            schema: {
              type: 'object',

              properties: {
                type: {
                  type: 'string',
                  enum: ['DOG', 'CAT'],
                },

                breed: {
                  type: ['string', 'null'],
                },

                color: {
                  type: ['string', 'null'],
                },

                distinctiveFeatures: {
                  type: ['string', 'null'],
                },

                description: {
                  type: ['string', 'null'],
                },
              },

              required: [
                'type',
                'breed',
                'color',
                'distinctiveFeatures',
                'description',
              ],

              additionalProperties: false,
            },
          },
        },

        max_tokens: 500,
      })) as OpenRouterChatCompletion;

      await this.createAiSuccessLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        response,
      );

      const content = response.choices[0]?.message.content;

      if (!content) {
        throw new Error('AI returned empty response');
      }

      return JSON.parse(content) as AiAnalysisResult;
    } catch (error: unknown) {
      await this.createAiErrorLog(
        ai_feature.ANALYZE_IMAGE,
        requestedModel,
        error,
      );

      throw error;
    }
  }
  //ส่วนย่อย ai log
  private async createAiSuccessLog(
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

  private async createAiErrorLog(
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
