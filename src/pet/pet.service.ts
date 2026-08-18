import { PrismaService } from '@/database/prisma.service';
import { Injectable } from '@nestjs/common';
import { CreatePetDto } from './dto/create-pet.dto';

@Injectable()
export class PetService {
  constructor(private readonly prisma: PrismaService) {}

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
}
