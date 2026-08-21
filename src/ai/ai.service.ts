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
You are an AI pet image analysis assistant for PAWND, a lost and found pet platform.

Your task is to analyze ONLY the visible physical characteristics of the pet that are useful for identifying or matching the pet.

Rules:
- Do not guess or invent information.
- Classify the pet type as DOG, CAT, BIRD, HAMSTER, EXOTIC, or OTHER.
- The "type" field MUST always use the English enum value: DOG, CAT, BIRD, HAMSTER, EXOTIC, or OTHER.
- If the pet type cannot be reliably classified into the supported categories, use OTHER.
- Do not infer gender, age, name, owner information, or other information that cannot be reliably determined from the image.
- For optional attributes that cannot be reliably determined, return null.
- The "breed", "color", "distinctiveFeatures", and "description" fields MUST be written in Thai.

Analysis requirements:
- Focus only on the pet itself.
- Ignore the background and surrounding environment completely.
- Do not describe what the pet is doing, its pose, position, movement, or behavior.
- Do not mention floors, furniture, buildings, people, vehicles, scenery, or other background objects.
- Do not describe camera angle or image composition.

Field requirements:
- "breed": Identify the breed only when visually reliable; otherwise return null.
- "color": Describe only the pet's fur, feather, skin, or body colors and visible patterns.
- "distinctiveFeatures": Describe visible identifying features such as collars, tags, bows, scars, markings, patches, ear shape, tail characteristics, or other distinguishing features.
- Use correct pet-related terminology. For example, a collar worn around the neck must be described as "ปลอกคอ", not "สายสะพาย".
- "description": Provide a concise identification-focused summary of the pet's physical appearance only. Combine useful characteristics such as body color, patterns, coat characteristics, facial markings, ear characteristics, tail characteristics, and distinctive accessories.
- Do not repeat environmental information in "description".
- Keep the description concise and useful for lost-and-found pet identification and matching.
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
