import { Test, TestingModule } from '@nestjs/testing';

import { CommunityController } from './community.controller';
import { CommunityService } from './community.service';

describe('CommunityController', () => {
  let controller: CommunityController;

  const mockCommunityService = {
    createPost: jest.fn(),
    listPosts: jest.fn(),
    getPostDetail: jest.fn(),
    updatePost: jest.fn(),
    deletePost: jest.fn(),
    addPostImages: jest.fn(),
    deletePostImage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CommunityController],
      providers: [
        {
          provide: CommunityService,
          useValue: mockCommunityService,
        },
      ],
    }).compile();

    controller = module.get<CommunityController>(CommunityController);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
