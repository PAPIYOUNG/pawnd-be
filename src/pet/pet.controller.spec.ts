import { PetGender, PetType } from '@/database/generated/prisma/enums';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePetDto } from './dto/create-pet.dto';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

describe('PetController', () => {
  let controller: PetController;

  const mockPetService = {
    createPet: jest.fn(),
    listMyPets: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PetController],
      providers: [
        {
          provide: PetService,
          useValue: mockPetService,
        },
      ],
    }).compile();

    controller = module.get<PetController>(PetController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createPet', () => {
    it('should call petService.createPet with current user id and dto', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const dto: CreatePetDto = {
        name: 'Luna',
        type: PetType.CAT,
        breed: 'Siamese',
        gender: PetGender.FEMALE,
        color: 'Seal Point',
        age: 2,
      };

      const expectedResponse = {
        pet: {
          id: '660e8400-e29b-41d4-a716-446655440002',
          ownerId,
          name: 'Luna',
          type: PetType.CAT,
          breed: 'Siamese',
          gender: PetGender.FEMALE,
          color: 'Seal Point',
          age: 2,
          profileImageUrl: null,
          createdAt: new Date(),
        },
      };

      mockPetService.createPet.mockResolvedValue(expectedResponse);

      const result = await controller.createPet(ownerId, dto);

      expect(mockPetService.createPet).toHaveBeenCalledWith(ownerId, dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('listMyPets', () => {
    it('should call petService.listMyPets with current user id and return pets list', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const expectedResponse = {
        pets: [
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
        ],
      };

      mockPetService.listMyPets.mockResolvedValue(expectedResponse);

      const result = await controller.listMyPets(ownerId);

      expect(mockPetService.listMyPets).toHaveBeenCalledWith(ownerId);
      expect(result).toEqual(expectedResponse);
    });
  });
});
