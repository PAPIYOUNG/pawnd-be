import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@/database/generated/prisma/client';
import { PrismaService } from '@/database/prisma.service';

import { CreateCommunityCommentDto } from './dto/create-community-comment.dto';
import { UpdateCommunityCommentDto } from './dto/update-community-comment.dto';

@Injectable()
export class CommentService {
  private readonly userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
  };

  constructor(private readonly prisma: PrismaService) {}

  async addComment(
    userId: string,
    postId: string,
    dto: CreateCommunityCommentDto,
  ) {
    await this.getVisiblePost(postId);

    return this.prisma.communityComment.create({
      data: {
        communityPostId: postId,
        userId,
        content: dto.content,
        imageUrl: dto.imageUrl,
      },
      include: {
        user: {
          select: this.userSelect,
        },
      },
    });
  }

  async updateComment(
    userId: string,
    commentId: string,
    dto: UpdateCommunityCommentDto,
  ) {
    await this.getOwnedComment(userId, commentId);

    const data: Prisma.CommunityCommentUncheckedUpdateInput = {};

    if (dto.content !== undefined) {
      data.content = dto.content;
    }

    if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    return this.prisma.communityComment.update({
      where: {
        id: commentId,
      },
      data,
      include: {
        user: {
          select: this.userSelect,
        },
      },
    });
  }

  async deleteComment(userId: string, commentId: string) {
    await this.getOwnedComment(userId, commentId);

    // Soft delete preserves report history.
    await this.prisma.communityComment.update({
      where: {
        id: commentId,
      },
      data: {
        isHidden: true,
      },
    });

    return {
      id: commentId,
      message: 'Community comment deleted',
    };
  }

  private async getVisiblePost(postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        isHidden: false,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    return post;
  }

  private async getOwnedComment(userId: string, commentId: string) {
    const comment = await this.prisma.communityComment.findFirst({
      where: {
        id: commentId,
        userId,
        isHidden: false,
        communityPost: {
          is: {
            isHidden: false,
          },
        },
      },
      select: {
        id: true,
      },
    });

    if (!comment) {
      throw new NotFoundException('Comment not found or you do not own it');
    }

    return comment;
  }
}
