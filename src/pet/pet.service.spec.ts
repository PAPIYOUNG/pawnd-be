import { PetGender, PetType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetService } from './pet.service';

describe('PetService', () => {
  let service: PetService;

  const mockPrismaService = {
    pet: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<PetService>(PetService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPet', () => {
    it('should create a pet successfully and return the expected pet structure', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const dto: CreatePetDto = {
        name: 'Milo',
        type: PetType.DOG,
        breed: 'Golden Retriever',
        gender: PetGender.MALE,
        color: 'Golden',
        age: 3,
        distinctiveFeatures: 'White patch on chest',
        description: 'Friendly and energetic dog',
      };

      const mockCreatedPet = {
        id: '660e8400-e29b-41d4-a716-446655440001',
        ownerId,
        name: 'Milo',
        type: PetType.DOG,
        breed: 'Golden Retriever',
        gender: PetGender.MALE,
        color: 'Golden',
        age: 3,
        profileImageUrl: null,
        createdAt: new Date(),
      };

      mockPrismaService.pet.create.mockResolvedValue(mockCreatedPet);

      const result = await service.createPet(ownerId, dto);

      expect(mockPrismaService.pet.create).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.pet.create).toHaveBeenCalledWith({
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

      expect(result).toEqual({ pet: mockCreatedPet });
    });
  });

  describe('listMyPets', () => {
    it('should return list of pets owned by the user', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const mockPets = [
        {
          id: '660e8400-e29b-41d4-a716-446655440001',
          name: 'Milo',
          type: PetType.DOG,
          breed: 'Golden Retriever',
          gender: PetGender.MALE,
          profileImageUrl: 'https://example.com/milo.jpg',
          qrCode: {
            qrToken: 'qr-token-12345',
          },
        },
        {
          id: '660e8400-e29b-41d4-a716-446655440002',
          name: 'Luna',
          type: PetType.CAT,
          breed: 'Siamese',
          gender: PetGender.FEMALE,
          profileImageUrl: null,
          qrCode: null,
        },
      ];

      mockPrismaService.pet.findMany.mockResolvedValue(mockPets);

      const result = await service.listMyPets(ownerId);

      expect(mockPrismaService.pet.findMany).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.pet.findMany).toHaveBeenCalledWith({
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

      expect(result).toEqual({ pets: mockPets });
    });

    it('should return empty pets array if user has no pets', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      mockPrismaService.pet.findMany.mockResolvedValue([]);

      const result = await service.listMyPets(ownerId);

      expect(result).toEqual({ pets: [] });
    });
  });

  describe('getPetDetail', () => {
    it('should return pet detail with images and qrCode when found', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const mockPet = {
        id: petId,
        name: 'Milo',
        type: PetType.DOG,
        breed: 'Golden Retriever',
        gender: PetGender.MALE,
        color: 'Golden',
        age: 3,
        distinctiveFeatures: 'White patch on chest',
        description: 'Friendly dog',
        profileImageUrl: 'https://example.com/milo.jpg',
        images: [
          {
            id: '770e8400-e29b-41d4-a716-446655440001',
            imageUrl: 'https://example.com/img1.jpg',
            isProfile: true,
            sortOrder: 0,
          },
        ],
        qrCode: {
          id: '880e8400-e29b-41d4-a716-446655440001',
          qrToken: 'qr-token-12345',
          qrImageUrl: 'https://example.com/qr.png',
          publicProfileUrl: 'https://pawnd.app/qr/qr-token-12345',
          isActive: true,
        },
      };

      mockPrismaService.pet.findFirst.mockResolvedValue(mockPet);

      const result = await service.getPetDetail(ownerId, petId);

      expect(mockPrismaService.pet.findFirst).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.pet.findFirst).toHaveBeenCalledWith({
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

      expect(result).toEqual({ pet: mockPet });
    });

    it('should throw NotFoundException if pet does not exist or does not belong to owner', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(service.getPetDetail(ownerId, petId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
