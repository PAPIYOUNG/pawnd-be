import { OpenRouterEmbeddingResponse } from '@/ai/types/openrouter-embedding.type';
import { PrismaService } from '@/database/prisma.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async createImageEmbedding(postImageId: string): Promise<void> {
    const postImage = await this.prisma.postImage.findUnique({
      where: {
        id: postImageId,
      },
    });

    if (!postImage) {
      throw new NotFoundException('Post image not found');
    }

    const model = this.configService.getOrThrow<string>(
      'AI_IMAGE_EMBEDDING_MODEL',
    );

    // เช็กก่อนว่าเคยสร้าง embedding ด้วย model แล้วไหม?
    const existingEmbedding = await this.prisma.$queryRaw<
      Array<{ id: string }>
    >`
      SELECT "id"
      FROM "image_embeddings"
      WHERE "post_image_id" = ${postImageId}::uuid
        AND "model_name" = ${model}
      LIMIT 1
    `;

    if (existingEmbedding.length > 0) {
      return;
    }

    const embedding = await this.generateImageEmbedding(
      postImage.imageUrl,
      model,
    );

    await this.saveEmbedding(postImageId, embedding, model);
  }

  private async generateImageEmbedding(
    imageUrl: string,
    model: string,
  ): Promise<number[]> {
    const baseUrl = this.configService.getOrThrow<string>(
      'OPENROUTER_BASE_URL',
    );

    const apiKey = this.configService.getOrThrow<string>('OPENROUTER_API_KEY');

    const dimension = this.configService.getOrThrow<number>(
      'AI_IMAGE_EMBEDDING_DIMENSION',
    );

    const response = await fetch(`${baseUrl}/embeddings`, {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        model,

        input: [
          {
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          },
        ],

        dimensions: dimension,
        encoding_format: 'float',
      }),
    });

    if (!response.ok) {
      const error = await response.text();

      throw new BadRequestException(`Embedding generation failed: ${error}`);
    }

    const result = (await response.json()) as OpenRouterEmbeddingResponse;

    const embedding = result.data[0]?.embedding;

    if (!embedding?.length) {
      throw new BadRequestException('Embedding model returned empty vector');
    }

    if (embedding.length !== dimension) {
      throw new BadRequestException(
        `Invalid embedding dimension: expected ${dimension}, received ${embedding.length}`,
      );
    }

    return embedding;
  }

  async calculatePostSimilarity(
    sourcePostId: string,
    candidatePostId: string,
  ): Promise<number> {
    const model = this.configService.getOrThrow<string>(
      'AI_IMAGE_EMBEDDING_MODEL',
    );

    const rows = await this.prisma.$queryRaw<
      Array<{
        similarity: number | null;
      }>
    >`
      SELECT
        MAX(
          1 - (
            source_embedding."embedding"
            <=>
            candidate_embedding."embedding"
          )
        )::double precision AS "similarity"

      FROM "image_embeddings" source_embedding

      INNER JOIN "post_images" source_image
        ON source_image."id" =
           source_embedding."post_image_id"

      CROSS JOIN "image_embeddings" candidate_embedding

      INNER JOIN "post_images" candidate_image
        ON candidate_image."id" =
           candidate_embedding."post_image_id"

      WHERE source_image."post_id" =
            ${sourcePostId}::uuid

        AND candidate_image."post_id" =
            ${candidatePostId}::uuid

        AND source_embedding."model_name" =
            ${model}

        AND candidate_embedding."model_name" =
            ${model}
    `;

    return this.clamp(rows[0]?.similarity ?? 0);
  }

  private async saveEmbedding(
    postImageId: string,
    embedding: number[],
    model: string,
  ): Promise<void> {
    const vector = `[${embedding.join(',')}]`;

    await this.prisma.$executeRaw`
      INSERT INTO "image_embeddings"
      (
        "id",
        "post_image_id",
        "embedding",
        "model_name",
        "dimension",
        "created_at"
      )
      VALUES (
        gen_random_uuid(),
        ${postImageId}::uuid,
        ${vector}::vector,
        ${model},
        ${embedding.length},
        NOW()
      )
    `;
  }

  private clamp(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}
