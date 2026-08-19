import { StreamableFile } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type { Response } from 'express';
import { FlyerTemplate } from './dto/generate-flyer.dto';
import { FlyerController } from './flyer.controller';
import { FlyerService } from './flyer.service';

describe('FlyerController', () => {
  let controller: FlyerController;

  const mockFlyerService = {
    generateFlyer: jest.fn(),
    getPostFlyer: jest.fn(),
    downloadFlyer: jest.fn(),
    listPostFlyers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [FlyerController],
      providers: [
        {
          provide: FlyerService,
          useValue: mockFlyerService,
        },
      ],
    }).compile();

    controller = module.get<FlyerController>(FlyerController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('generateFlyer', () => {
    it('should call flyerService.generateFlyer with userId, postId, and dto', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const dto = { template: FlyerTemplate.STANDARD };
      const expectedResponse = {
        flyer: {
          id: 'flyer-1',
          postId,
          fileUrl: 'https://cloudinary.com/flyer.pdf',
          qrUrl: 'https://cloudinary.com/qr.png',
          generatedAt: new Date(),
        },
      };

      mockFlyerService.generateFlyer.mockResolvedValue(expectedResponse);

      const result = await controller.generateFlyer(userId, postId, dto);

      expect(mockFlyerService.generateFlyer).toHaveBeenCalledWith(
        userId,
        postId,
        dto,
      );
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('getPostFlyer', () => {
    it('should call flyerService.getPostFlyer with userId and postId', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const expectedResponse = {
        flyer: {
          id: 'flyer-1',
          fileUrl: 'https://cloudinary.com/flyer.pdf',
          qrUrl: 'https://cloudinary.com/qr.png',
          generatedAt: new Date(),
        },
      };

      mockFlyerService.getPostFlyer.mockResolvedValue(expectedResponse);

      const result = await controller.getPostFlyer(userId, postId);

      expect(mockFlyerService.getPostFlyer).toHaveBeenCalledWith(userId, postId);
      expect(result).toEqual(expectedResponse);
    });
  });

  describe('downloadFlyer', () => {
    it('should set headers and return StreamableFile', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const mockBuffer = Buffer.from('PDF binary content');

      mockFlyerService.downloadFlyer.mockResolvedValue(mockBuffer);

      const mockResponse = {
        set: jest.fn(),
      } as unknown as Response;

      const result = await controller.downloadFlyer(
        userId,
        postId,
        mockResponse,
      );

      expect(mockFlyerService.downloadFlyer).toHaveBeenCalledWith(
        userId,
        postId,
      );
      expect(mockResponse.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="flyer-${postId}.pdf"`,
        'Content-Length': mockBuffer.length.toString(),
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });

  describe('listPostFlyers', () => {
    it('should call flyerService.listPostFlyers with userId and postId', async () => {
      const userId = 'user-1';
      const postId = 'post-1';
      const expectedResponse = {
        flyers: [
          {
            id: 'flyer-1',
            fileUrl: 'https://cloudinary.com/flyer-1.pdf',
            generatedAt: new Date(),
          },
        ],
      };

      mockFlyerService.listPostFlyers.mockResolvedValue(expectedResponse);

      const result = await controller.listPostFlyers(userId, postId);

      expect(mockFlyerService.listPostFlyers).toHaveBeenCalledWith(
        userId,
        postId,
      );
      expect(result).toEqual(expectedResponse);
    });
  });
});
