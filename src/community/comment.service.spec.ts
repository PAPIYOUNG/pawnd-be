import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { PrismaService } from '@/database/prisma.service';

import { CommentService } from './comment.service';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { UpdateCommunityCommentDto } from './dto/update-community-comment.dto';

describe('CommentService', () => {
  let service: CommentService;

  const mockPrismaService = {
    communityPost: {
      findFirst: jest.fn(),
    },
    communityComment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<CommentService>(CommentService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addComment', () => {
    it('should create a comment successfully', async () => {
      const userId = 'user-id';
      const postId = 'post-id';

      const dto: CreateCommunityCommentDto = {
        content: 'This is a comment',
        imageUrl: 'https://example.com/comment.jpg',
      };

      const expectedComment = {
        id: 'comment-id',
        communityPostId: postId,
        userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
      };

      mockPrismaService.communityPost.findFirst.mockResolvedValue({
        id: postId,
      });

      mockPrismaService.communityComment.create.mockResolvedValue(
        expectedComment,
      );

      const result = await service.addComment(userId, postId, dto);

      expect(mockPrismaService.communityPost.findFirst).toHaveBeenCalledWith({
        where: {
          id: postId,
          isHidden: false,
        },
        select: {
          id: true,
        },
      });

      expect(mockPrismaService.communityComment.create).toHaveBeenCalled();

      expect(result).toEqual(expectedComment);
    });

    it('should throw if post does not exist', async () => {
      mockPrismaService.communityPost.findFirst.mockResolvedValue(null);

      await expect(
        service.addComment('user-id', 'post-id', {
          content: 'Comment',
          imageUrl: 'https://example.com/image.jpg',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateComment', () => {
    it('should update a comment owned by the user', async () => {
      const userId = 'user-id';
      const commentId = 'comment-id';

      const dto: UpdateCommunityCommentDto = {
        content: 'Updated comment',
      };

      const updatedComment = {
        id: commentId,
        content: dto.content,
      };

      mockPrismaService.communityComment.findFirst.mockResolvedValue({
        id: commentId,
      });

      mockPrismaService.communityComment.update.mockResolvedValue(
        updatedComment,
      );

      const result = await service.updateComment(userId, commentId, dto);

      expect(mockPrismaService.communityComment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            id: commentId,
          },
          data: {
            content: dto.content,
          },
        }),
      );

      expect(result).toEqual(updatedComment);
    });

    it('should throw if comment does not belong to the user', async () => {
      mockPrismaService.communityComment.findFirst.mockResolvedValue(null);

      await expect(
        service.updateComment('other-user', 'comment-id', {
          content: 'Updated',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if no update fields are provided', async () => {
      mockPrismaService.communityComment.findFirst.mockResolvedValue({
        id: 'comment-id',
      });

      await expect(
        service.updateComment('user-id', 'comment-id', {}),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('deleteComment', () => {
    it('should soft delete a comment', async () => {
      const userId = 'user-id';
      const commentId = 'comment-id';

      mockPrismaService.communityComment.findFirst.mockResolvedValue({
        id: commentId,
      });

      mockPrismaService.communityComment.update.mockResolvedValue({
        id: commentId,
        isHidden: true,
      });

      const result = await service.deleteComment(userId, commentId);

      expect(mockPrismaService.communityComment.update).toHaveBeenCalledWith({
        where: {
          id: commentId,
        },
        data: {
          isHidden: true,
        },
      });

      expect(result).toEqual({
        id: commentId,
        message: 'Community comment deleted',
      });
    });
  });
});
