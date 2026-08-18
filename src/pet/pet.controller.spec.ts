import { PetGender, PetType } from '@/database/generated/prisma/enums';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetController } from './pet.controller';
import { PetService } from './pet.service';

describe('PetController', () => {
  let controller: PetController;

  const mockPetService = {
    createPet: jest.fn(),
    listMyPets: jest.fn(),
    getPetDetail: jest.fn(),
    updatePet: jest.fn(),
    deletePet: jest.fn(),
    uploadPetImages: jest.fn(),
    deletePetImage: jest.fn(),
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

  describe('getPetDetail', () => {
    it('should call petService.getPetDetail with current user id and pet id', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const expectedResponse = {
        pet: {
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
          images: [],
          qrCode: {
            id: '880e8400-e29b-41d4-a716-446655440001',
            qrToken: 'qr-token-12345',
            qrImageUrl: 'https://example.com/qr.png',
            publicProfileUrl: 'https://pawnd.app/qr/qr-token-12345',
            isActive: true,
          },
        },
      };

      mockPetService.getPetDetail.mockResolvedValue(expectedResponse);

      const result = await controller.getPetDetail(ownerId, petId);

      expect(mockPetService.getPetDetail).toHaveBeenCalledWith(ownerId, petId);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('updatePet', () => {
    it('should call petService.updatePet with ownerId, petId, and dto', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const dto: UpdatePetDto = { name: 'Milo 2' };
      const expectedResponse = {
        pet: {
          id: petId,
          name: 'Milo 2',
          type: PetType.DOG,
          breed: 'Golden Retriever',
          gender: PetGender.MALE,
          color: 'Golden',
          age: 3,
          updatedAt: new Date(),
        },
      };

      mockPetService.updatePet.mockResolvedValue(expectedResponse);

      const result = await controller.updatePet(ownerId, petId, dto);

      expect(mockPetService.updatePet).toHaveBeenCalledWith(ownerId, petId, dto);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('deletePet', () => {
    it('should call petService.deletePet with ownerId and petId', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const expectedResponse = { message: 'Pet deleted successfully' };

      mockPetService.deletePet.mockResolvedValue(expectedResponse);

      const result = await controller.deletePet(ownerId, petId);

      expect(mockPetService.deletePet).toHaveBeenCalledWith(ownerId, petId);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('uploadPetImages', () => {
    it('should call petService.uploadPetImages with ownerId, petId, and files', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const mockFiles = [
        { buffer: Buffer.from('test') },
      ] as Express.Multer.File[];
      const expectedResponse = {
        images: [
          {
            id: '770e8400-e29b-41d4-a716-446655440001',
            petId,
            imageUrl: 'https://cloudinary.com/test.jpg',
            isProfile: true,
            sortOrder: 0,
          },
        ],
      };

      mockPetService.uploadPetImages.mockResolvedValue(expectedResponse);

      const result = await controller.uploadPetImages(ownerId, petId, mockFiles);

      expect(mockPetService.uploadPetImages).toHaveBeenCalledWith(
        ownerId,
        petId,
        mockFiles,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('deletePetImage', () => {
    it('should call petService.deletePetImage with ownerId, petId, and imageId', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';
      const expectedResponse = { message: 'Image deleted successfully' };

      mockPetService.deletePetImage.mockResolvedValue(expectedResponse);

      const result = await controller.deletePetImage(ownerId, petId, imageId);

      expect(mockPetService.deletePetImage).toHaveBeenCalledWith(
        ownerId,
        petId,
        imageId,
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
