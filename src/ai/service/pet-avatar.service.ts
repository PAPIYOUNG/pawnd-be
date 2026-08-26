import { GeneratePetAvatarDto } from '@/ai/dto/generate-pet-avatar.dto';
import { createMockPetAvatarDataUrl } from '@/ai/mock-ai.data';
import { OpenRouterImageResponse } from '@/ai/types/openrouter-image-response.type';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class PetAvatarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async generatePetAvatar(dto: GeneratePetAvatarDto) {
    // =========================================================
    // 1. FIND PET
    // =========================================================


    const pet = await this.prisma.pet.findUnique({
      where: {
        id: dto.petId,
      },

      include: {
        images: true,
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    // =========================================================
    // 2. VALIDATE REFERENCE IMAGES
    // รูปทั้งหมดที่ส่งมาต้องเป็นรูปของ Pet ตัวนี้จริง
    // =========================================================

    const selectedImages = dto.imageUrls.map((imageUrl) => {
      const image = pet.images.find(
        (petImage) => petImage.imageUrl === imageUrl,
      );

      if (!image) {
        throw new BadRequestException(
          'One or more images do not belong to this pet',
        );
      }

      return image;
    });

    if (selectedImages.length === 0) {
      throw new BadRequestException('At least one pet image is required');
    }

    // =========================================================
    // 3. GET OR CREATE AVATAR QUOTA
    // =========================================================

    const quota = await this.getOrCreateQuota(pet.ownerId);

    // =========================================================
    // 4. CHECK QUOTA
    // =========================================================

    if (quota.usedCount >= quota.limit) {
      throw new HttpException(
        `Pet avatar generation limit reached. You have used ${quota.usedCount}/${quota.limit} generations in cycle ${quota.cycle}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // =========================================================
    // 5. GENERATE AVATAR
    // =========================================================

    const imageUrls = selectedImages.map((image) => image.imageUrl);

    const generatedImage = await this.generateWithOpenRouter(imageUrls);

    const avatarUrl = this.isMockMode()
      ? generatedImage
      : await this.cloudinaryService.uploadBase64(
          generatedImage,
          'pawnd/pet-avatars',
        );
    // =========================================================
    // 6. INCREMENT QUOTA
    // ทำหลัง Generate สำเร็จเท่านั้น
    // =========================================================

    const updatedQuota = await this.prisma.aiAvatarQuota.update({
      where: {
        id: quota.id,
      },

      data: {
        usedCount: {
          increment: 1,
        },
      },
    });

    // =========================================================
    // 7. RESPONSE
    // =========================================================

    return {
      petId: pet.id,

      sourceImages: selectedImages.map((image) => ({
        id: image.id,
        imageUrl: image.imageUrl,
      })),

      avatar: {
        imageUrl: avatarUrl,
        model:
          this.configService.get<string>('AI_PET_AVATAR_MODEL') ??
          'mock/pet-avatar',
        style: '3D_VOXEL',
      },

      quota: {
        used: updatedQuota.usedCount,
        limit: updatedQuota.limit,

        remaining: Math.max(updatedQuota.limit - updatedQuota.usedCount, 0),

        cycle: updatedQuota.cycle,
      },
    };
  }

  // =========================================================
  // OPENROUTER IMAGE GENERATION
  // =========================================================

  private async generateWithOpenRouter(imageUrls: string[]): Promise<string> {
    if (this.isMockMode()) {
      return createMockPetAvatarDataUrl();
    }

    const apiKey = this.configService.getOrThrow<string>('OPENROUTER_API_KEY');

    const baseUrl =
      this.configService.get<string>('OPENROUTER_BASE_URL') ??
      'https://openrouter.ai/api/v1';

    const model = this.configService.getOrThrow<string>('AI_PET_AVATAR_MODEL');

    const prompt = `
Create a cute 3D voxel-style avatar of the exact pet shown in the reference images.

IMPORTANT:
All reference images show the SAME pet.
Use all reference images together to understand and preserve the pet's identity.

IDENTITY REQUIREMENTS:
- Preserve the same animal species.
- Preserve the pet's real fur color.
- Preserve fur patterns and markings.
- Preserve facial markings.
- Preserve ear shape.
- Preserve eye appearance where clearly visible.
- Preserve distinctive physical characteristics.
- Preserve recognizable accessories only when clearly visible in the reference images.
- Do not invent new markings.
- Do not change the pet into another breed.
- Do not change the pet's natural colors.

STYLE:
- Cute stylized 3D voxel art.
- Block-based voxel geometry.
- High-quality game character avatar.
- Friendly and charming appearance.
- Slightly simplified proportions while preserving identity.
- Full body.
- Single pet only.
- Centered composition.
- Front three-quarter view.
- Professional soft studio lighting.
- Consistent PAWND pet-avatar aesthetic.

BACKGROUND:
- Simple minimal studio background.
- No scenery.
- No furniture.
- No humans.
- No other animals.

DO NOT ADD:
- text
- logo
- watermark
- clothes
- hats
- glasses
- accessories that are not visible in the original reference images

The final result should clearly look like the same pet shown across all reference images, transformed into a polished 3D voxel character.
    `.trim();

    const response = await fetch(`${baseUrl}/images`, {
      method: 'POST',

      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },

      body: JSON.stringify({
        model,
        prompt,

        input_references: imageUrls.map((url) => ({
          type: 'image_url',

          image_url: {
            url,
          },
        })),

        n: 1,

        resolution: '2K',

        aspect_ratio: '1:1',
      }),
    });

    // =========================================================
    // OPENROUTER ERROR
    // =========================================================

    if (!response.ok) {
      const errorBody = await response.text();

      if (response.status === 402) {
        throw new HttpException(
          'Pet avatar generation is temporarily unavailable due to insufficient AI credits.',
          HttpStatus.SERVICE_UNAVAILABLE,
        );
      }

      throw new BadRequestException(
        `Pet avatar generation failed: ${errorBody}`,
      );
    }

    // =========================================================
    // PARSE RESPONSE
    // =========================================================

    const result = (await response.json()) as OpenRouterImageResponse;

    const generatedImage = result.data?.[0]?.b64_json;

    if (!generatedImage) {
      throw new BadRequestException('Pet avatar generation returned no image');
    }

    // =========================================================
    // BASE64 → DATA URL
    // =========================================================

    return `data:image/jpeg;base64,${generatedImage}`;
  }

  // =========================================================
  // QUOTA
  // =========================================================

  private async getOrCreateQuota(userId: string) {
    const existing = await this.prisma.aiAvatarQuota.findUnique({
      where: {
        userId,
      },
    });

    if (existing) {
      return existing;
    }

    return this.prisma.aiAvatarQuota.create({
      data: {
        userId,

        usedCount: 0,

        limit: 2,

        cycle: 1,
      },
    });
  }

  private isMockMode(): boolean {
    const raw = this.configService.get<boolean | string>('AI_MOCK_MODE');
    if (raw === false || raw === 'false' || process.env.AI_MOCK_MODE === 'false') return false;
    if (raw === true || raw === 'true' || process.env.AI_MOCK_MODE === 'true') return true;
    return false;
  }
}



