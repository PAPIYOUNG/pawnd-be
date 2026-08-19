import { PetGender, PetType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetService } from './pet.service';

describe('PetService', () => {
  let service: PetService;

  const mockPrismaService = {
    pet: {
      create: jest.fn(),
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
});
