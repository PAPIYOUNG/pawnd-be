import { PetGender, PetType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CreatePetDto } from './dto/create-pet.dto';
import { UpdatePetDto } from './dto/update-pet.dto';
import { PetService } from './pet.service';

describe('PetService', () => {
  let service: PetService;

  const mockPrismaService = {
    pet: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    petImage: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    petQrCode: {
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(async (cb: (tx: any) => Promise<any>) =>
      cb(mockPrismaService),
    ),
  };

  const mockCloudinaryService = {
    upload: jest.fn(),
    deletePetQrCode: jest.fn(),
    deleteAsset: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PetService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
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

  describe('updatePet', () => {
    it('should update pet successfully when owner matches', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const dto: UpdatePetDto = {
        name: 'Milo Updated',
        age: 4,
      };

      const mockUpdatedPet = {
        id: petId,
        name: 'Milo Updated',
        type: PetType.DOG,
        breed: 'Golden Retriever',
        gender: PetGender.MALE,
        color: 'Golden',
        age: 4,
        updatedAt: new Date(),
      };

      mockPrismaService.pet.findFirst.mockResolvedValue({ id: petId });
      mockPrismaService.pet.update.mockResolvedValue(mockUpdatedPet);

      const result = await service.updatePet(ownerId, petId, dto);

      expect(mockPrismaService.pet.findFirst).toHaveBeenCalledWith({
        where: { id: petId, ownerId },
        select: { id: true },
      });
      expect(mockPrismaService.pet.update).toHaveBeenCalledWith({
        where: { id: petId },
        data: {
          name: dto.name,
          age: dto.age,
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

      expect(result).toEqual({ pet: mockUpdatedPet });
    });

    it('should throw NotFoundException if pet not found on update', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.updatePet(ownerId, petId, { name: 'New' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePet', () => {
    it('should delete pet and associated relations successfully', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: petId,
        images: [
          {
            imageUrl:
              'https://res.cloudinary.com/demo/image/upload/v1234567890/pawnd/pets/img1.jpg',
          },
        ],
      });

      const result = await service.deletePet(ownerId, petId);

      expect(mockPrismaService.pet.findFirst).toHaveBeenCalledWith({
        where: { id: petId, ownerId },
        include: {
          images: {
            select: { imageUrl: true },
          },
        },
      });
      expect(mockPrismaService.petImage.deleteMany).toHaveBeenCalledWith({
        where: { petId },
      });
      expect(mockPrismaService.petQrCode.deleteMany).toHaveBeenCalledWith({
        where: { petId },
      });
      expect(mockPrismaService.pet.delete).toHaveBeenCalledWith({
        where: { id: petId },
      });
      expect(mockCloudinaryService.deletePetQrCode).toHaveBeenCalledWith(petId);
      expect(mockCloudinaryService.deleteAsset).toHaveBeenCalledWith(
        'pawnd/pets/img1',
        'image',
      );
      expect(result).toEqual({ message: 'Pet deleted successfully' });
    });

    it('should throw NotFoundException if pet not found on delete', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(service.deletePet(ownerId, petId)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('uploadPetImages', () => {
    it('should upload images, save records, and update profile image if needed', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const mockFiles = [
        { buffer: Buffer.from('test1'), originalname: 'dog1.jpg' },
      ] as Express.Multer.File[];

      const mockPet = {
        id: petId,
        ownerId,
        profileImageUrl: null,
        images: [],
      };

      mockPrismaService.pet.findFirst.mockResolvedValue(mockPet);
      mockCloudinaryService.upload.mockResolvedValue(
        'https://cloudinary.com/img1.jpg',
      );

      const mockCreatedImage = {
        id: '770e8400-e29b-41d4-a716-446655440001',
        petId,
        imageUrl: 'https://cloudinary.com/img1.jpg',
        isProfile: true,
        sortOrder: 0,
      };

      mockPrismaService.petImage.create.mockResolvedValue(mockCreatedImage);

      const result = await service.uploadPetImages(ownerId, petId, mockFiles);

      expect(mockCloudinaryService.upload).toHaveBeenCalledWith(mockFiles[0]);
      expect(mockPrismaService.petImage.create).toHaveBeenCalledWith({
        data: {
          petId,
          imageUrl: 'https://cloudinary.com/img1.jpg',
          sortOrder: 0,
          isProfile: true,
        },
        select: {
          id: true,
          petId: true,
          imageUrl: true,
          isProfile: true,
          sortOrder: true,
        },
      });
      expect(mockPrismaService.pet.update).toHaveBeenCalledWith({
        where: { id: petId },
        data: { profileImageUrl: 'https://cloudinary.com/img1.jpg' },
      });
      expect(result).toEqual({ images: [mockCreatedImage] });
    });

    it('should throw BadRequestException if files array is empty', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';

      await expect(service.uploadPetImages(ownerId, petId, [])).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if pet not found on upload', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const mockFiles = [
        { buffer: Buffer.from('test') },
      ] as Express.Multer.File[];

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.uploadPetImages(ownerId, petId, mockFiles),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deletePetImage', () => {
    it('should delete pet image successfully', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue({
        id: petId,
        profileImageUrl: 'https://cloudinary.com/other.jpg',
      });
      mockPrismaService.petImage.findFirst.mockResolvedValue({
        id: imageId,
        petId,
        imageUrl:
          'https://res.cloudinary.com/demo/image/upload/v1234567890/pawnd/pets/img1.jpg',
        isProfile: false,
      });

      const result = await service.deletePetImage(ownerId, petId, imageId);

      expect(mockPrismaService.petImage.delete).toHaveBeenCalledWith({
        where: { id: imageId },
      });
      expect(mockCloudinaryService.deleteAsset).toHaveBeenCalledWith(
        'pawnd/pets/img1',
        'image',
      );
      expect(result).toEqual({ message: 'Image deleted successfully' });
    });

    it('should throw NotFoundException if pet does not exist on delete image', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePetImage(ownerId, petId, imageId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if image does not exist on delete image', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue({ id: petId });
      mockPrismaService.petImage.findFirst.mockResolvedValue(null);

      await expect(
        service.deletePetImage(ownerId, petId, imageId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('setProfileImage', () => {
    it('should set profile image and update pet profileImageUrl successfully', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';
      const mockImage = {
        id: imageId,
        imageUrl: 'https://cloudinary.com/new-profile.jpg',
      };
      const mockUpdatedPet = {
        id: petId,
        profileImageUrl: 'https://cloudinary.com/new-profile.jpg',
      };

      mockPrismaService.pet.findFirst.mockResolvedValue({ id: petId });
      mockPrismaService.petImage.findFirst.mockResolvedValue(mockImage);
      mockPrismaService.pet.update.mockResolvedValue(mockUpdatedPet);

      const result = await service.setProfileImage(ownerId, petId, imageId);

      expect(mockPrismaService.pet.findFirst).toHaveBeenCalledWith({
        where: { id: petId, ownerId },
        select: { id: true },
      });
      expect(mockPrismaService.petImage.findFirst).toHaveBeenCalledWith({
        where: { id: imageId, petId },
        select: { id: true, imageUrl: true },
      });
      expect(mockPrismaService.petImage.updateMany).toHaveBeenCalledWith({
        where: { petId },
        data: { isProfile: false },
      });
      expect(mockPrismaService.petImage.update).toHaveBeenCalledWith({
        where: { id: imageId },
        data: { isProfile: true },
      });
      expect(mockPrismaService.pet.update).toHaveBeenCalledWith({
        where: { id: petId },
        data: { profileImageUrl: mockImage.imageUrl },
        select: {
          id: true,
          profileImageUrl: true,
        },
      });
      expect(result).toEqual({ pet: mockUpdatedPet });
    });

    it('should throw NotFoundException if pet not found on setProfileImage', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue(null);

      await expect(
        service.setProfileImage(ownerId, petId, imageId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if image not found on setProfileImage', async () => {
      const ownerId = '550e8400-e29b-41d4-a716-446655440000';
      const petId = '660e8400-e29b-41d4-a716-446655440001';
      const imageId = '770e8400-e29b-41d4-a716-446655440001';

      mockPrismaService.pet.findFirst.mockResolvedValue({ id: petId });
      mockPrismaService.petImage.findFirst.mockResolvedValue(null);

      await expect(
        service.setProfileImage(ownerId, petId, imageId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
