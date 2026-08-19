import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';

@Injectable()
export class PetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  async createPet(ownerId: string, dto: CreatePetDto) {
    const pet = await this.prisma.pet.create({
      data: {
        ownerId,
        name: dto.name,
        type: dto.type,
        breed: dto.breed,
        gender: dto.gender,
        color: dto.color,
        age: dto.age,
        distinctiveFeatures: dto.distinctiveFeatures,
        description: dto.description,
      },
      select: {
        id: true,
        ownerId: true,
        name: true,
        type: true,
        breed: true,
        gender: true,
        color: true,
        age: true,
        profileImageUrl: true,
        createdAt: true,
      },
    });

    return { pet };
  }

  async listMyPets(ownerId: string) {
    const pets = await this.prisma.pet.findMany({
      where: { ownerId },
      select: {
        id: true,
        name: true,
        type: true,
        breed: true,
        gender: true,
        profileImageUrl: true,
        qrCode: {
          select: {
            qrToken: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { pets };
  }

  async getPetDetail(ownerId: string, petId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: {
        id: petId,
        ownerId,
      },
      select: {
        id: true,
        name: true,
        type: true,
        breed: true,
        gender: true,
        color: true,
        age: true,
        distinctiveFeatures: true,
        description: true,
        profileImageUrl: true,
        images: {
          select: {
            id: true,
            imageUrl: true,
            isProfile: true,
            sortOrder: true,
          },
          orderBy: { sortOrder: 'asc' },
        },
        qrCode: {
          select: {
            id: true,
            qrToken: true,
            qrImageUrl: true,
            publicProfileUrl: true,
            isActive: true,
          },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    return { pet };
  }

  async updatePet(ownerId: string, petId: string, dto: UpdatePetDto) {
    const existing = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('Pet not found');
    }

    const pet = await this.prisma.pet.update({
      where: { id: petId },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.breed !== undefined && { breed: dto.breed }),
        ...(dto.gender !== undefined && { gender: dto.gender }),
        ...(dto.color !== undefined && { color: dto.color }),
        ...(dto.age !== undefined && { age: dto.age }),
        ...(dto.distinctiveFeatures !== undefined && {
          distinctiveFeatures: dto.distinctiveFeatures,
        }),
        ...(dto.description !== undefined && { description: dto.description }),
      },
      select: {
        id: true,
        name: true,
        type: true,
        breed: true,
        gender: true,
        color: true,
        age: true,
        updatedAt: true,
      },
    });

    return { pet };
  }

  async deletePet(ownerId: string, petId: string) {
    const existing = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      include: {
        images: {
          select: { imageUrl: true },
        },
      },
    });

    if (!existing) {
      throw new NotFoundException('Pet not found');
    }

    const imageUrls = existing.images?.map((img) => img.imageUrl) || [];

    await this.prisma.$transaction(async (tx) => {
      await tx.petImage.deleteMany({ where: { petId } });
      await tx.petQrCode.deleteMany({ where: { petId } });
      await tx.pet.delete({ where: { id: petId } });
    });

    try {
      await this.cloudinaryService.deletePetQrCode(petId);
    } catch {
      // Ignore Cloudinary cleanup failure if no QR was uploaded
    }

    for (const url of imageUrls) {
      const publicId = this.extractPublicIdFromUrl(url);
      if (publicId) {
        try {
          await this.cloudinaryService.deleteAsset(publicId, 'image');
        } catch {
          // Ignore Cloudinary cleanup failure
        }
      }
    }

    return { message: 'Pet deleted successfully' };
  }

  async uploadPetImages(
    ownerId: string,
    petId: string,
    files: Express.Multer.File[],
  ) {
    if (!files || files.length === 0) {
      throw new BadRequestException('No images provided');
    }

    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      include: {
        images: {
          orderBy: { sortOrder: 'desc' },
          take: 1,
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    const currentImagesCount = await this.prisma.petImage.count({
      where: { petId },
    });

    if (currentImagesCount + files.length > 3) {
      throw new BadRequestException(
        `Maximum 3 images allowed per pet. You currently have ${currentImagesCount} images.`,
      );
    }

    const startSortOrder =
      pet.images.length > 0 ? pet.images[0].sortOrder + 1 : 0;
    const uploadedImagesData: {
      imageUrl: string;
      sortOrder: number;
      isProfile: boolean;
    }[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const imageUrl = await this.cloudinaryService.upload(file);
      const isProfile = !pet.profileImageUrl && i === 0;
      uploadedImagesData.push({
        imageUrl,
        sortOrder: startSortOrder + i,
        isProfile,
      });
    }

    const createdImages = await this.prisma.$transaction(async (tx) => {
      const results: {
        id: string;
        petId: string;
        imageUrl: string;
        isProfile: boolean;
        sortOrder: number;
      }[] = [];
      for (const data of uploadedImagesData) {
        const img = await tx.petImage.create({
          data: {
            petId,
            imageUrl: data.imageUrl,
            sortOrder: data.sortOrder,
            isProfile: data.isProfile,
          },
          select: {
            id: true,
            petId: true,
            imageUrl: true,
            isProfile: true,
            sortOrder: true,
          },
        });
        results.push(img);
      }

      if (!pet.profileImageUrl && uploadedImagesData.length > 0) {
        await tx.pet.update({
          where: { id: petId },
          data: { profileImageUrl: uploadedImagesData[0].imageUrl },
        });
      }

      return results;
    });

    return { images: createdImages };
  }

  async deletePetImage(ownerId: string, petId: string, imageId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      select: { id: true, profileImageUrl: true },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    const image = await this.prisma.petImage.findFirst({
      where: { id: imageId, petId },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.petImage.delete({ where: { id: imageId } });

      if (image.isProfile || pet.profileImageUrl === image.imageUrl) {
        const nextImage = await tx.petImage.findFirst({
          where: { petId },
          orderBy: { sortOrder: 'asc' },
        });

        if (nextImage) {
          await tx.petImage.update({
            where: { id: nextImage.id },
            data: { isProfile: true },
          });
          await tx.pet.update({
            where: { id: petId },
            data: { profileImageUrl: nextImage.imageUrl },
          });
        } else {
          await tx.pet.update({
            where: { id: petId },
            data: { profileImageUrl: null },
          });
        }
      }
    });

    const publicId = this.extractPublicIdFromUrl(image.imageUrl);
    if (publicId) {
      try {
        await this.cloudinaryService.deleteAsset(publicId, 'image');
      } catch {
        // Ignore Cloudinary cleanup failure
      }
    }

    return { message: 'Image deleted successfully' };
  }

  private extractPublicIdFromUrl(url: string): string | null {
    const match = url.match(/\/upload\/(?:v\d+\/)?([^\.]+)/);
    return match ? match[1] : null;
  }

  async setProfileImage(ownerId: string, petId: string, imageId: string) {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId },
      select: { id: true },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    const image = await this.prisma.petImage.findFirst({
      where: { id: imageId, petId },
      select: { id: true, imageUrl: true },
    });

    if (!image) {
      throw new NotFoundException('Image not found');
    }

    const updatedPet = await this.prisma.$transaction(async (tx) => {
      await tx.petImage.updateMany({
        where: { petId },
        data: { isProfile: false },
      });

      await tx.petImage.update({
        where: { id: imageId },
        data: { isProfile: true },
      });

      return tx.pet.update({
        where: { id: petId },
        data: { profileImageUrl: image.imageUrl },
        select: {
          id: true,
          profileImageUrl: true,
        },
      });
    });

    return { pet: updatedPet };
  }
}
