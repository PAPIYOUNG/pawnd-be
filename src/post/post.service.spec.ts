/// <reference types="jest" />

import type { AiMatchingService } from '@/ai/ai-matching.service';
import {
  PetType,
  PostEventType,
  PostStatus,
  PostType,
} from '@/database/generated/prisma/enums';
import type { PrismaService } from '@/database/prisma.service';
import { FlyerTemplate } from '@/flyer/dto/generate-flyer.dto';
import type { FlyerService } from '@/flyer/flyer.service';
import type { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import type { EmbeddingService } from '@/ai/service/embedding.service';
import type { PostEventsService } from '@/post-events/post-events.service';

import { CreatePostDto } from './dto/create-post.dto';
import { PostService } from './post.service';

describe('PostService', () => {
  const userId = '00000000-0000-4000-8000-000000000001';
  const postId = '00000000-0000-4000-8000-000000000002';

  const prismaMock = {
    pet: {
      findFirst: jest.fn(),
    },
    petPost: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const transactionClient = {
    petPost: {
      create: jest.fn(),
      update: jest.fn(),
    },
    postEvent: {
      create: jest.fn(),
    },
  };
  const cloudinaryMock = {};
  const flyerMock = {
    generateFlyer: jest.fn(),
  };
  const aiMatchingMock = {};
  const embeddingMock = {};
  const postEventsMock = {
    recordEvent: jest.fn(),
  };

  let service: PostService;

  beforeEach(() => {
    jest.resetAllMocks();
    // จำลอง transaction ให้ callback ใช้ client เดียวกับที่ตรวจสอบ event
    prismaMock.$transaction.mockImplementation(
      async (
        callback: (client: typeof transactionClient) => Promise<unknown>,
      ) => callback(transactionClient),
    );
    transactionClient.petPost.create.mockResolvedValue({ id: postId });
    transactionClient.petPost.update.mockResolvedValue({ id: postId });
    flyerMock.generateFlyer.mockResolvedValue({ id: 'flyer-id' });

    service = new PostService(
      prismaMock as unknown as PrismaService,
      cloudinaryMock as unknown as CloudinaryService,
      flyerMock as unknown as FlyerService,
      aiMatchingMock as unknown as AiMatchingService,
      embeddingMock as unknown as EmbeddingService,
      postEventsMock as unknown as PostEventsService,
    );
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('records POST_CREATED in the same transaction as a new post', async () => {
    const dto = {
      type: PostType.LOST,
      petType: PetType.CAT,
      eventDate: '2026-08-27T00:00:00.000Z',
      latitude: 13.7563,
      longitude: 100.5018,
    } as CreatePostDto;

    await service.createPost(userId, dto);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.petPost.create).toHaveBeenCalledTimes(1);
    expect(postEventsMock.recordEvent).toHaveBeenCalledWith(transactionClient, {
      postId,
      eventType: PostEventType.POST_CREATED,
      createdBy: userId,
    });
    expect(flyerMock.generateFlyer).toHaveBeenCalledWith(userId, postId, {
      template: FlyerTemplate.STANDARD,
    });
  });

  it('records a lifecycle event when status changes to reunited', async () => {
    prismaMock.petPost.findFirst.mockResolvedValue({
      id: postId,
      status: PostStatus.ACTIVE,
    });

    await service.changeStatus(postId, userId, PostStatus.REUNITED);

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
    expect(transactionClient.petPost.update).toHaveBeenCalledTimes(1);
    expect(postEventsMock.recordEvent).toHaveBeenCalledWith(transactionClient, {
      postId,
      eventType: PostEventType.REUNITED,
      createdBy: userId,
    });
  });
});
