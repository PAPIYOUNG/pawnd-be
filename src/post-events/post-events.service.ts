import { Injectable, NotFoundException } from '@nestjs/common';

import type { Prisma } from '../database/generated/prisma/client';
import { PostEventType, PostStatus } from '../database/generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';

export type RecordPostEventInput = {
  postId: string;
  eventType: PostEventType;
  createdBy?: string | null;
};

type PostEventDatabaseClient = Pick<Prisma.TransactionClient, 'postEvent'>;

const PUBLIC_POST_STATUSES: PostStatus[] = [
  PostStatus.ACTIVE,
  PostStatus.REUNITED,
  PostStatus.CLOSED,
];

@Injectable()
export class PostEventsService {
  constructor(private readonly prisma: PrismaService) {}

  // Caller validates business rules and uses the same transaction as the domain action.
  recordEvent(client: PostEventDatabaseClient, input: RecordPostEventInput) {
    return client.postEvent.create({
      data: {
        postId: input.postId,
        eventType: input.eventType,
        createdBy: input.createdBy ?? null,
      },
    });
  }

  async getPostEvents(postId: string) {
    const post = await this.prisma.petPost.findUnique({
      where: { id: postId },
      select: { status: true },
    });

    if (!post || !PUBLIC_POST_STATUSES.includes(post.status)) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.postEvent.findMany({
      where: { postId },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        eventType: true,
        description: true,
        createdAt: true,
      },
    });
  }
}
