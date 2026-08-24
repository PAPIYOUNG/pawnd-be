import { Test, TestingModule } from '@nestjs/testing';

import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { UpdateCommunityCommentDto } from './dto/update-community-comment.dto';

describe('CommentController', () => {
  let controller: CommentController;

  const mockCommentService = {
    addComment: jest.fn(),
    updateComment: jest.fn(),
    deleteComment: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommentController],
      providers: [
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
      ],
    }).compile();

    controller = module.get<CommentController>(CommentController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call addComment', async () => {
    const dto: CreateCommunityCommentDto = {
      content: 'Comment',
      imageUrl: 'https://example.com/comment.jpg',
    };

    const response = { id: 'comment-id' };

    mockCommentService.addComment.mockResolvedValue(response);

    const result = await controller.addComment('user-id', 'post-id', dto);

    expect(mockCommentService.addComment).toHaveBeenCalledWith(
      'user-id',
      'post-id',
      dto,
    );

    expect(result).toEqual(response);
  });

  it('should call updateComment', async () => {
    const dto: UpdateCommunityCommentDto = {
      content: 'Updated comment',
    };

    const response = { id: 'comment-id' };

    mockCommentService.updateComment.mockResolvedValue(response);

    const result = await controller.updateComment('user-id', 'comment-id', dto);

    expect(mockCommentService.updateComment).toHaveBeenCalledWith(
      'user-id',
      'comment-id',
      dto,
    );

    expect(result).toEqual(response);
  });

  it('should call deleteComment', async () => {
    const response = {
      id: 'comment-id',
      message: 'Community comment deleted',
    };

    mockCommentService.deleteComment.mockResolvedValue(response);

    const result = await controller.deleteComment('user-id', 'comment-id');

    expect(mockCommentService.deleteComment).toHaveBeenCalledWith(
      'user-id',
      'comment-id',
    );

    expect(result).toEqual(response);
  });
});
