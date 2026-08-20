import { Test, TestingModule } from '@nestjs/testing';
import { HomeService } from './home.service';
import { PrismaService } from '@/database/prisma.service';
import {
  PostStatus,
  PostType,
  UserStatus,
} from '@/database/generated/prisma/enums';

describe('HomeService', () => {
  let service: HomeService;

  const mockPrismaService = {
    petPost: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HomeService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<HomeService>(HomeService);
    jest.clearAllMocks();
  });

  describe('getSummaryStats', () => {
    it('should calculate and return summary stats correctly', async () => {
      mockPrismaService.petPost.count
        .mockResolvedValueOnce(142) // totalLost
        .mockResolvedValueOnce(98) // totalFound
        .mockResolvedValueOnce(64); // totalReunited

      mockPrismaService.user.count.mockResolvedValueOnce(512); // totalUsers

      const result = await service.getSummaryStats();

      expect(mockPrismaService.petPost.count).toHaveBeenCalledTimes(3);
      expect(mockPrismaService.user.count).toHaveBeenCalledWith({
        where: { status: UserStatus.ACTIVE },
      });

      expect(result).toEqual({
        stats: {
          totalLost: 142,
          totalFound: 98,
          totalReunited: 64,
          totalUsers: 512,
        },
      });
    });
  });

  describe('getLatestPosts', () => {
    it('should return latest posts with mapped fields and cover images', async () => {
      const mockDbPosts = [
        {
          id: 'post-1',
          type: PostType.LOST,
          petName: 'Bella',
          petType: 'DOG',
          breed: 'Golden Retriever',
          province: 'Bangkok',
          createdAt: new Date('2026-08-20T10:00:00Z'),
          pet: null,
          images: [{ imageUrl: 'https://cloudinary.com/bella.jpg' }],
        },
        {
          id: 'post-2',
          type: PostType.FOUND,
          petName: null,
          petType: null,
          breed: null,
          province: 'Nonthaburi',
          createdAt: new Date('2026-08-20T09:00:00Z'),
          pet: {
            name: 'Kitty',
            type: 'CAT',
            profileImageUrl: 'https://cloudinary.com/kitty.jpg',
          },
          images: [],
        },
      ];

      mockPrismaService.petPost.findMany.mockResolvedValue(mockDbPosts);

      const result = await service.getLatestPosts({
        type: PostType.LOST,
        limit: 10,
      });

      expect(mockPrismaService.petPost.findMany).toHaveBeenCalledWith({
        where: {
          status: PostStatus.ACTIVE,
          type: PostType.LOST,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: expect.any(Object),
      });

      expect(result.posts).toHaveLength(2);
      expect(result.posts[0]).toEqual({
        id: 'post-1',
        type: PostType.LOST,
        petName: 'Bella',
        petType: 'DOG',
        province: 'Bangkok',
        coverImageUrl: 'https://cloudinary.com/bella.jpg',
        createdAt: mockDbPosts[0].createdAt,
      });
      expect(result.posts[1]).toEqual({
        id: 'post-2',
        type: PostType.FOUND,
        petName: 'Kitty',
        petType: 'CAT',
        province: 'Nonthaburi',
        coverImageUrl: 'https://cloudinary.com/kitty.jpg',
        createdAt: mockDbPosts[1].createdAt,
      });
    });
  });

  describe('getRecentReunited', () => {
    it('should return reunited posts ordered by reunitedAt descending', async () => {
      const mockReunitedPosts = [
        {
          id: 'post-3',
          petName: 'Milo',
          petType: 'CAT',
          breed: 'Scottish Fold',
          province: 'Chiang Mai',
          reunitedAt: new Date('2026-08-20T12:00:00Z'),
          updatedAt: new Date('2026-08-20T12:00:00Z'),
          pet: null,
          images: [{ imageUrl: 'https://cloudinary.com/milo.jpg' }],
        },
      ];

      mockPrismaService.petPost.findMany.mockResolvedValue(mockReunitedPosts);

      const result = await service.getRecentReunited({ limit: 6 });

      expect(mockPrismaService.petPost.findMany).toHaveBeenCalledWith({
        where: { status: PostStatus.REUNITED },
        orderBy: [{ reunitedAt: 'desc' }, { updatedAt: 'desc' }],
        take: 6,
        select: expect.any(Object),
      });

      expect(result.posts).toHaveLength(1);
      expect(result.posts[0]).toEqual({
        id: 'post-3',
        petName: 'Milo',
        petType: 'CAT',
        province: 'Chiang Mai',
        reunitedAt: mockReunitedPosts[0].reunitedAt,
        coverImageUrl: 'https://cloudinary.com/milo.jpg',
      });
    });
  });

  describe('getHomepageContent', () => {
    it('should return emergency guides and featured safety tips', () => {
      const result = service.getHomepageContent();

      expect(result).toHaveProperty('content');
      expect(result.content.emergencyGuides.length).toBeGreaterThan(0);
      expect(result.content.featuredTips.length).toBeGreaterThan(0);
    });
  });
});
