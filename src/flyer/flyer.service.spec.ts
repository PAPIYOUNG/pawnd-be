import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { FlyerTemplate } from './dto/generate-flyer.dto';
import { FlyerService } from './flyer.service';

describe('FlyerService', () => {
  let service: FlyerService;

  const mockPrismaService = {
    petPost: {
      findUnique: jest.fn(),
    },
    flyer: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      if (key === 'PORT') return 8000;
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      return defaultValue;
    }),
  };

  const mockCloudinaryService = {
    uploadFlyerPdf: jest.fn(),
    uploadFlyerQrCode: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlyerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CloudinaryService,
          useValue: mockCloudinaryService,
        },
      ],
    }).compile();

    service = module.get<FlyerService>(FlyerService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('generateFlyer', () => {
    it('should generate printable flyer poster and save record successfully', async () => {
      const userId = 'user-uuid-1';
      const postId = 'post-uuid-1';

      const mockPost = {
        id: postId,
        userId,
        type: 'LOST',
        status: 'ACTIVE',
        petName: 'Milo',
        petType: 'DOG',
        breed: 'Golden Retriever',
        gender: 'MALE',
        color: 'Golden',
        distinctiveFeatures: 'White patch',
        description: 'Lost near park',
        eventDate: new Date(),
        province: 'Bangkok',
        district: 'Chatuchak',
        subdistrict: 'Chomphon',
        rewardAmount: '5000',
        contactPhone: '0812345678',
        contactLineId: 'milo_owner',
        contactEmail: 'owner@example.com',
        user: {
          firstName: 'Somchai',
          lastName: 'Jaidee',
          phone: '0812345678',
        },
        pet: null,
        images: [],
      };

      const mockFlyerRecord = {
        id: 'flyer-uuid-1',
        postId,
        fileUrl: `http://localhost:8000/posts/${postId}/flyer/download`,
        qrUrl: 'https://cloudinary.com/qr.png',
        generatedAt: new Date(),
      };

      mockPrismaService.petPost.findUnique.mockResolvedValue(mockPost);
      mockCloudinaryService.uploadFlyerQrCode.mockResolvedValue(
        'https://cloudinary.com/qr.png',
      );
      mockCloudinaryService.uploadFlyerPdf.mockResolvedValue(
        'https://cloudinary.com/flyer.pdf',
      );
      mockPrismaService.flyer.create.mockResolvedValue(mockFlyerRecord);

      const result = await service.generateFlyer(userId, postId, {
        template: FlyerTemplate.STANDARD,
      });

      expect(mockPrismaService.petPost.findUnique).toHaveBeenCalledWith({
        where: { id: postId },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          user: true,
          pet: true,
        },
      });
      expect(mockCloudinaryService.uploadFlyerQrCode).toHaveBeenCalledTimes(1);
      expect(mockCloudinaryService.uploadFlyerPdf).toHaveBeenCalledTimes(1);
      expect(mockPrismaService.flyer.create).toHaveBeenCalledWith({
        data: {
          postId,
          fileUrl: `http://localhost:8000/posts/${postId}/flyer/download`,
          qrUrl: 'https://cloudinary.com/qr.png',
        },
        select: {
          id: true,
          postId: true,
          fileUrl: true,
          qrUrl: true,
          generatedAt: true,
        },
      });
      expect(result).toEqual({ flyer: mockFlyerRecord });
    }, 15000);

    it('should throw NotFoundException if post is DELETED or HIDDEN', async () => {
      mockPrismaService.petPost.findUnique.mockResolvedValue({
        id: 'post-1',
        status: 'DELETED',
      });

      await expect(
        service.generateFlyer('user-1', 'post-1', {
          template: FlyerTemplate.STANDARD,
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if post not found', async () => {
      mockPrismaService.petPost.findUnique.mockResolvedValue(null);

      await expect(
        service.generateFlyer('user-1', 'post-1', {
          template: FlyerTemplate.STANDARD,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getPostFlyer', () => {
    it('should return latest flyer for post', async () => {
      const mockFlyer = {
        id: 'flyer-1',
        fileUrl: 'https://cloudinary.com/flyer.pdf',
        qrUrl: 'https://cloudinary.com/qr.png',
        generatedAt: new Date(),
      };

      mockPrismaService.flyer.findFirst.mockResolvedValue(mockFlyer);

      const result = await service.getPostFlyer('user-1', 'post-1');

      expect(mockPrismaService.flyer.findFirst).toHaveBeenCalledWith({
        where: { postId: 'post-1' },
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          fileUrl: true,
          qrUrl: true,
          generatedAt: true,
        },
      });
      expect(result).toEqual({ flyer: mockFlyer });
    });

    it('should throw NotFoundException if no flyer found for post', async () => {
      mockPrismaService.flyer.findFirst.mockResolvedValue(null);

      await expect(service.getPostFlyer('user-1', 'post-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('listPostFlyers', () => {
    it('should return list of all flyers for post', async () => {
      const mockFlyers = [
        {
          id: 'flyer-1',
          fileUrl: 'https://cloudinary.com/flyer-1.pdf',
          generatedAt: new Date(),
        },
        {
          id: 'flyer-2',
          fileUrl: 'https://cloudinary.com/flyer-2.pdf',
          generatedAt: new Date(),
        },
      ];

      mockPrismaService.flyer.findMany.mockResolvedValue(mockFlyers);

      const result = await service.listPostFlyers('user-1', 'post-1');

      expect(mockPrismaService.flyer.findMany).toHaveBeenCalledWith({
        where: { postId: 'post-1' },
        orderBy: { generatedAt: 'desc' },
        select: {
          id: true,
          fileUrl: true,
          generatedAt: true,
        },
      });
      expect(result).toEqual({ flyers: mockFlyers });
    });
  });

  describe('downloadFlyer', () => {
    it('should throw NotFoundException if flyer record not found', async () => {
      mockPrismaService.flyer.findFirst.mockResolvedValue(null);

      await expect(service.downloadFlyer('user-1', 'post-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
