import { Test, TestingModule } from '@nestjs/testing';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';
import { PostType } from '@/database/generated/prisma/enums';

describe('HomeController', () => {
  let controller: HomeController;

  const mockHomeService = {
    getSummaryStats: jest.fn(),
    getLatestPosts: jest.fn(),
    getRecentReunited: jest.fn(),
    getHomepageContent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HomeController],
      providers: [
        {
          provide: HomeService,
          useValue: mockHomeService,
        },
      ],
    }).compile();

    controller = module.get<HomeController>(HomeController);
    jest.clearAllMocks();
  });

  describe('getSummaryStats', () => {
    it('should return summary stats from HomeService', async () => {
      const mockStats = {
        stats: {
          totalLost: 10,
          totalFound: 5,
          totalReunited: 3,
          totalUsers: 25,
        },
      };

      mockHomeService.getSummaryStats.mockResolvedValue(mockStats);

      const result = await controller.getSummaryStats();

      expect(mockHomeService.getSummaryStats).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockStats);
    });
  });

  describe('getLatestPosts', () => {
    it('should return latest posts from HomeService', async () => {
      const mockResult = {
        posts: [
          {
            id: 'post-1',
            type: PostType.LOST,
            petName: 'Bella',
            petType: 'DOG',
            province: 'Bangkok',
            coverImageUrl: 'https://...',
            createdAt: new Date(),
          },
        ],
      };

      mockHomeService.getLatestPosts.mockResolvedValue(mockResult);

      const result = await controller.getLatestPosts({
        type: PostType.LOST,
        limit: 10,
      });

      expect(mockHomeService.getLatestPosts).toHaveBeenCalledWith({
        type: PostType.LOST,
        limit: 10,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getRecentReunited', () => {
    it('should return recent reunited posts from HomeService', async () => {
      const mockResult = {
        posts: [
          {
            id: 'post-2',
            petName: 'Milo',
            petType: 'CAT',
            province: 'Chiang Mai',
            reunitedAt: new Date(),
            coverImageUrl: 'https://...',
          },
        ],
      };

      mockHomeService.getRecentReunited.mockResolvedValue(mockResult);

      const result = await controller.getRecentReunited({ limit: 6 });

      expect(mockHomeService.getRecentReunited).toHaveBeenCalledWith({
        limit: 6,
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe('getHomepageContent', () => {
    it('should return homepage content from HomeService', () => {
      const mockContent = {
        content: {
          emergencyGuides: [],
          featuredTips: [],
        },
      };

      mockHomeService.getHomepageContent.mockReturnValue(mockContent);

      const result = controller.getHomepageContent();

      expect(mockHomeService.getHomepageContent).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockContent);
    });
  });
});
