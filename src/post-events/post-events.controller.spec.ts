/// <reference types="jest" />

import { NotFoundException } from '@nestjs/common';

import { PostEventsController } from './post-events.controller';
import { PostEventsService } from './post-events.service';

jest.mock('../database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('PostEventsController', () => {
  let controller: PostEventsController;
  const postEventsService = {
    getPostEvents: jest.fn(),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new PostEventsController(
      postEventsService as unknown as PostEventsService,
    );
  });

  it('delegates the happy path to PostEventsService', async () => {
    const postId = '00000000-0000-4000-8000-000000000010';
    const events = [
      {
        id: '00000000-0000-4000-8000-000000000001',
        eventType: 'POST_CREATED',
        description: 'Post created',
        createdAt: new Date('2026-08-18T01:00:00.000Z'),
      },
    ];
    postEventsService.getPostEvents.mockResolvedValue(events);

    await expect(controller.getPostEvents(postId)).resolves.toEqual(events);
    expect(postEventsService.getPostEvents).toHaveBeenCalledWith(postId);
  });

  it.each(['post not found', 'HIDDEN', 'DELETED'])(
    'propagates the shared not found response for %s',
    async () => {
      const error = new NotFoundException('Post not found');
      postEventsService.getPostEvents.mockRejectedValue(error);

      await expect(
        controller.getPostEvents('00000000-0000-4000-8000-000000000010'),
      ).rejects.toBe(error);
    },
  );
});
