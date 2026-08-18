/// <reference types="jest" />

import { NotFoundException } from '@nestjs/common';

import { PostEventType, PostStatus } from '../database/generated/prisma/enums';
import type { PrismaService } from '../database/prisma.service';
import { PostEventsService } from './post-events.service';

jest.mock('../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PostEventsService', () => {
  let service: PostEventsService;
  const prisma = {
    petPost: {
      findUnique: jest.fn(),
    },
    postEvent: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.resetAllMocks();
    service = new PostEventsService(prisma as unknown as PrismaService);
  });

  it.each([PostStatus.ACTIVE, PostStatus.REUNITED, PostStatus.CLOSED])(
    'returns ordered public fields for a %s post',
    async (status) => {
      const events = [
        {
          id: '00000000-0000-4000-8000-000000000001',
          eventType: PostEventType.POST_CREATED,
          description: 'Post created',
          createdAt: new Date('2026-08-18T01:00:00.000Z'),
        },
      ];
      prisma.petPost.findUnique.mockResolvedValue({ status });
      prisma.postEvent.findMany.mockResolvedValue(events);

      await expect(
        service.getPostEvents('00000000-0000-4000-8000-000000000010'),
      ).resolves.toEqual(events);
      expect(prisma.petPost.findUnique).toHaveBeenCalledWith({
        where: { id: '00000000-0000-4000-8000-000000000010' },
        select: { status: true },
      });
      expect(prisma.postEvent.findMany).toHaveBeenCalledWith({
        where: { postId: '00000000-0000-4000-8000-000000000010' },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          eventType: true,
          description: true,
          createdAt: true,
        },
      });
    },
  );

  it('throws the shared not found response when the post does not exist', async () => {
    prisma.petPost.findUnique.mockResolvedValue(null);

    await expect(
      service.getPostEvents('00000000-0000-4000-8000-000000000010'),
    ).rejects.toThrow(new NotFoundException('Post not found'));
    expect(prisma.postEvent.findMany).not.toHaveBeenCalled();
  });

  it.each([PostStatus.HIDDEN, PostStatus.DELETED])(
    'throws the shared not found response for a %s post',
    async (status) => {
      prisma.petPost.findUnique.mockResolvedValue({ status });

      await expect(
        service.getPostEvents('00000000-0000-4000-8000-000000000010'),
      ).rejects.toThrow(new NotFoundException('Post not found'));
      expect(prisma.postEvent.findMany).not.toHaveBeenCalled();
    },
  );
});
