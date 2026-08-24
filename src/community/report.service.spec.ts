import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ReportType } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';

import { CreateReportDto } from './dto/create-report.dto';
import { ReportService } from './report.service';

describe('ReportService', () => {
  let service: ReportService;

  const mockPrismaService = {
    communityPost: {
      findFirst: jest.fn(),
    },
    communityComment: {
      findFirst: jest.fn(),
    },
    contentReport: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReportService>(ReportService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should create a post report', async () => {
    const dto: CreateReportDto = {
      reportType: ReportType.POST,
      communityPostId: 'post-id',
      reason: 'Inappropriate content',
    };

    const expectedReport = {
      id: 'report-id',
      reporterId: 'user-id',
      reportType: ReportType.POST,
      communityPostId: 'post-id',
      commentId: null,
      reason: dto.reason,
    };

    mockPrismaService.communityPost.findFirst.mockResolvedValue({
      id: 'post-id',
    });

    mockPrismaService.contentReport.create.mockResolvedValue(expectedReport);

    const result = await service.createReport('user-id', dto);

    expect(mockPrismaService.communityPost.findFirst).toHaveBeenCalled();

    expect(mockPrismaService.contentReport.create).toHaveBeenCalledWith({
      data: {
        reporterId: 'user-id',
        reportType: ReportType.POST,
        communityPostId: 'post-id',
        commentId: null,
        reason: dto.reason,
      },
    });

    expect(result).toEqual(expectedReport);
  });

  it('should create a comment report', async () => {
    const dto: CreateReportDto = {
      reportType: ReportType.COMMENT,
      commentId: 'comment-id',
      reason: 'Abusive comment',
    };

    const expectedReport = {
      id: 'report-id',
      reporterId: 'user-id',
      reportType: ReportType.COMMENT,
      communityPostId: null,
      commentId: 'comment-id',
      reason: dto.reason,
    };

    mockPrismaService.communityComment.findFirst.mockResolvedValue({
      id: 'comment-id',
    });

    mockPrismaService.contentReport.create.mockResolvedValue(expectedReport);

    const result = await service.createReport('user-id', dto);

    expect(mockPrismaService.communityComment.findFirst).toHaveBeenCalled();

    expect(result).toEqual(expectedReport);
  });

  it('should reject when both postId and commentId are provided', async () => {
    const dto: CreateReportDto = {
      reportType: ReportType.POST,
      communityPostId: 'post-id',
      commentId: 'comment-id',
      reason: 'Invalid report',
    };

    await expect(service.createReport('user-id', dto)).rejects.toThrow(
      BadRequestException,
    );

    expect(mockPrismaService.contentReport.create).not.toHaveBeenCalled();
  });

  it('should reject when no target is provided', async () => {
    const dto: CreateReportDto = {
      reportType: ReportType.POST,
      reason: 'Missing target',
    };

    await expect(service.createReport('user-id', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject POST report with commentId', async () => {
    const dto: CreateReportDto = {
      reportType: ReportType.POST,
      commentId: 'comment-id',
      reason: 'Wrong target type',
    };

    await expect(service.createReport('user-id', dto)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw when reported post does not exist', async () => {
    mockPrismaService.communityPost.findFirst.mockResolvedValue(null);

    const dto: CreateReportDto = {
      reportType: ReportType.POST,
      communityPostId: 'post-id',
      reason: 'Post not found',
    };

    await expect(service.createReport('user-id', dto)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('should throw when reported comment does not exist', async () => {
    mockPrismaService.communityComment.findFirst.mockResolvedValue(null);

    const dto: CreateReportDto = {
      reportType: ReportType.COMMENT,
      commentId: 'comment-id',
      reason: 'Comment not found',
    };

    await expect(service.createReport('user-id', dto)).rejects.toThrow(
      NotFoundException,
    );
  });
});
