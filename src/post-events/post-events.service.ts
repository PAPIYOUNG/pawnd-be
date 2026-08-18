import { Injectable, NotFoundException } from '@nestjs/common';

import { PostStatus } from '../database/generated/prisma/enums';
import { PrismaService } from '../database/prisma.service';

const PUBLIC_POST_STATUSES: PostStatus[] = [
  PostStatus.ACTIVE,
  PostStatus.REUNITED,
  PostStatus.CLOSED,
];

@Injectable()
export class PostEventsService {
  constructor(private readonly prisma: PrismaService) {}

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
