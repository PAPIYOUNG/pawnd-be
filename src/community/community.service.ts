import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@/database/generated/prisma/client';
import { PostStatus } from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';
import { CloudinaryResourceType } from '@/infrastructure/upload/type/cloudinary-resource.types';
import { CreateCommunityPostDto } from './dto/create-community-post.dto';
import { UpdateCommunityPostDto } from './dto/update-community-post.dto';
import { CommunityPostQueryDto } from './dto/community-post-query.dto';

@Injectable()
export class CommunityService {
  private readonly userSelect = {
    id: true,
    firstName: true,
    lastName: true,
    avatarUrl: true,
  };

  private getCloudinaryResourceType(
    value: string | null | undefined,
  ): CloudinaryResourceType {
    switch (value) {
      case 'image':
      case 'video':
      case 'raw':
        return value;
      default:
        return 'image';
    }
  }

  private readonly postListInclude = {
    user: {
      select: this.userSelect,
    },
    images: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
    },
  };

  private readonly postDetailInclude = {
    user: {
      select: this.userSelect,
    },
    relatedPetPost: {
      select: {
        id: true,
        type: true,
        status: true,
        createdAt: true,
      },
    },
    images: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
    },
    comments: {
      where: {
        isHidden: false,
      },
      orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
      include: {
        user: {
          select: this.userSelect,
        },
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createPost(userId: string, dto: CreateCommunityPostDto) {
    if (dto.relatedPetPostId) {
      const relatedPost = await this.prisma.petPost.findFirst({
        where: {
          id: dto.relatedPetPostId,
          status: {
            not: PostStatus.DELETED,
          },
        },
        select: {
          id: true,
        },
      });

      if (!relatedPost) {
        throw new NotFoundException('Related pet post not found');
      }
    }

    return this.prisma.communityPost.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        relatedPetPostId: dto.relatedPetPostId ?? null,
      },
      include: this.postDetailInclude,
    });
  }

  async listPosts(query: CommunityPostQueryDto) {
    const where: Prisma.CommunityPostWhereInput = {
      isHidden: false,
    };

    if (query.type) {
      where.type = query.type;
    }

    if (query.q?.trim()) {
      const search = query.q.trim();

      where.OR = [
        {
          title: {
            contains: search,
            mode: 'insensitive',
          },
        },
        {
          content: {
            contains: search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.communityPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        include: this.postListInclude,
      }),
      this.prisma.communityPost.count({ where }),
    ]);

    return {
      data,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPostDetail(postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        isHidden: false,
      },
      include: this.postDetailInclude,
    });

    if (!post) {
      throw new NotFoundException('Community post not found');
    }

    return post;
  }

  async updatePost(
    userId: string,
    postId: string,
    dto: UpdateCommunityPostDto,
  ) {
    await this.getOwnedPost(userId, postId);

    const data: Prisma.CommunityPostUncheckedUpdateInput = {};

    if (dto.type !== undefined) {
      data.type = dto.type;
    }

    if (dto.title !== undefined) {
      data.title = dto.title;
    }

    if (dto.content !== undefined) {
      data.content = dto.content;
    }

    if (dto.relatedPetPostId !== undefined) {
      data.relatedPetPostId = dto.relatedPetPostId;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    await this.prisma.communityPost.update({
      where: {
        id: postId,
      },
      data,
    });

    return this.getPostDetail(postId);
  }

  async deletePost(userId: string, postId: string) {
    await this.getOwnedPost(userId, postId);

    // Soft delete because schema.prisma has isHidden.
    await this.prisma.communityPost.update({
      where: {
        id: postId,
      },
      data: {
        isHidden: true,
      },
    });

    return {
      id: postId,
      message: 'Community post deleted',
    };
  }

  async addPostImages(
    userId: string,
    postId: string,
    files: Express.Multer.File[],
  ) {
    await this.getOwnedPost(userId, postId);

    if (!files?.length) {
      throw new BadRequestException('At least one image is required');
    }

    for (const file of files) {
      if (!file.mimetype.startsWith('image/')) {
        throw new BadRequestException('Only image files are allowed');
      }

      if (file.size > 5 * 1024 * 1024) {
        throw new BadRequestException('Each image must be smaller than 5 MB');
      }
    }

    const lastImage = await this.prisma.communityPostImage.findFirst({
      where: {
        communityPostId: postId,
      },
      orderBy: {
        sortOrder: 'desc',
      },
      select: {
        sortOrder: true,
      },
    });

    const startOrder = lastImage ? lastImage.sortOrder + 1 : 0;

    const maxImages = 3;

    const currentCount = await this.prisma.communityPostImage.count({
      where: {
        communityPostId: postId,
      },
    });

    if (currentCount + files.length > maxImages) {
      throw new BadRequestException(
        `A post can have maximum ${maxImages} images`,
      );
    }

    const imageUrls = await Promise.all(
      files.map((file) => this.cloudinary.upload(file)),
    );

    const images = await this.prisma.$transaction(
      imageUrls.map((imageUrl, index) =>
        this.prisma.communityPostImage.create({
          data: {
            communityPostId: postId,
            imageUrl,
            sortOrder: startOrder + index,
          },
        }),
      ),
    );

    return { images };
  }

  async deletePostImage(userId: string, postId: string, imageId: string) {
    await this.getOwnedPost(userId, postId);

    const image = await this.prisma.communityPostImage.findFirst({
      where: {
        id: imageId,
        communityPostId: postId,
      },
    });

    if (!image) {
      throw new NotFoundException('Community post image not found');
    }

    if (image.cloudinaryPublicId) {
      await this.cloudinary.deleteAsset(
        image.cloudinaryPublicId,
        this.getCloudinaryResourceType(image.cloudinaryResourceType),
      );
    }

    await this.prisma.communityPostImage.delete({
      where: {
        id: imageId,
      },
    });

    return {
      imageId,
      message: 'Community post image deleted',
    };
  }

  private async getOwnedPost(userId: string, postId: string) {
    const post = await this.prisma.communityPost.findFirst({
      where: {
        id: postId,
        userId,
        isHidden: false,
      },
      select: {
        id: true,
      },
    });

    if (!post) {
      throw new NotFoundException('Post not found or you do not own it');
    }

    return post;
  }
}
