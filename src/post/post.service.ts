import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '@/database/generated/prisma/client';
import { PostStatus } from '@/database/generated/prisma/enums';

import { PrismaService } from '@/database/prisma.service';
import { CloudinaryService } from '@/infrastructure/upload/cloudinary.service';

import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { PostQueryDto, SearchPostsDto } from './dto/post-query.dto';

@Injectable()
export class PostService {
  private readonly publicStatuses: PostStatus[] = [
    PostStatus.ACTIVE,
    PostStatus.REUNITED,
    PostStatus.CLOSED,
  ];

  private readonly postInclude = {
    user: {
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatarUrl: true,
      },
    },
    pet: true,
    images: {
      orderBy: {
        sortOrder: 'asc' as const,
      },
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly cloudinary: CloudinaryService,
  ) {}

  async createPost(userId: string, dto: CreatePostDto) {
    if (dto.petId) {
      const pet = await this.prisma.pet.findFirst({
        where: {
          id: dto.petId,
          ownerId: userId,
        },
        select: { id: true },
      });

      if (!pet) {
        throw new NotFoundException('Pet not found');
      }
    }

    const post = await this.prisma.petPost.create({
      data: {
        userId,
        petId: dto.petId,
        type: dto.type,
        petName: dto.petName,
        petType: dto.petType,
        breed: dto.breed,
        gender: dto.gender,
        color: dto.color,
        distinctiveFeatures: dto.distinctiveFeatures,
        description: dto.description,
        eventDate: new Date(dto.eventDate),
        latitude: dto.latitude,
        longitude: dto.longitude,
        province: dto.province,
        district: dto.district,
        subdistrict: dto.subdistrict,
        locationDescription: dto.locationDescription,
        rewardAmount: dto.rewardAmount,
        currentLocation: dto.currentLocation,
        contactPhone: dto.contactPhone,
        contactLineId: dto.contactLineId,
        contactEmail: dto.contactEmail,
      } satisfies Prisma.PetPostUncheckedCreateInput,
      include: this.postInclude,
    });

    return post;
  }

  async getAllPosts(query: PostQueryDto) {
    const where: Prisma.PetPostWhereInput = {
      status: query.status ?? PostStatus.ACTIVE,
      ...(query.type && { type: query.type }),
      ...(query.petType && { petType: query.petType }),
    };

    return this.paginate(where, query);
  }

  async getMyPosts(userId: string, query: PostQueryDto) {
    const where: Prisma.PetPostWhereInput = {
      userId,
      status:
        query.status && query.status !== PostStatus.DELETED
          ? query.status
          : { not: PostStatus.DELETED },
      ...(query.type && { type: query.type }),
      ...(query.petType && { petType: query.petType }),
    };

    return this.paginate(where, query);
  }

  async searchPosts(query: SearchPostsDto) {
    const status =
      query.status && this.publicStatuses.includes(query.status)
        ? query.status
        : PostStatus.ACTIVE;

    const where: Prisma.PetPostWhereInput = {
      status,
      ...(query.type && { type: query.type }),
      ...(query.petType && { petType: query.petType }),
    };

    if (query.q) {
      where.OR = [
        { petName: { contains: query.q, mode: 'insensitive' } },
        { breed: { contains: query.q, mode: 'insensitive' } },
        { color: { contains: query.q, mode: 'insensitive' } },
        {
          description: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
        {
          distinctiveFeatures: {
            contains: query.q,
            mode: 'insensitive',
          },
        },
      ];
    }

    if (query.province) {
      where.province = {
        contains: query.province,
        mode: 'insensitive',
      };
    }

    if (query.district) {
      where.district = {
        contains: query.district,
        mode: 'insensitive',
      };
    }

    if (query.minReward !== undefined || query.maxReward !== undefined) {
      where.rewardAmount = {
        ...(query.minReward !== undefined && {
          gte: query.minReward,
        }),
        ...(query.maxReward !== undefined && {
          lte: query.maxReward,
        }),
      };
    }

    if (query.eventFrom || query.eventTo) {
      where.eventDate = {
        ...(query.eventFrom && {
          gte: new Date(query.eventFrom),
        }),
        ...(query.eventTo && {
          lte: new Date(query.eventTo),
        }),
      };
    }

    return this.paginate(where, query);
  }

  async getPostStats() {
    const notDeleted: Prisma.PetPostWhereInput = {
      status: { not: PostStatus.DELETED },
    };

    const [total, active, reunited, closed, lost, found, totalViews] =
      await Promise.all([
        this.prisma.petPost.count({ where: notDeleted }),
        this.prisma.petPost.count({
          where: { ...notDeleted, status: PostStatus.ACTIVE },
        }),
        this.prisma.petPost.count({
          where: { ...notDeleted, status: PostStatus.REUNITED },
        }),
        this.prisma.petPost.count({
          where: { ...notDeleted, status: PostStatus.CLOSED },
        }),
        this.prisma.petPost.count({
          where: { ...notDeleted, type: 'LOST' },
        }),
        this.prisma.petPost.count({
          where: { ...notDeleted, type: 'FOUND' },
        }),
        this.prisma.petPost.aggregate({
          where: notDeleted,
          _sum: { viewCount: true },
        }),
      ]);

    return {
      total,
      byStatus: {
        active,
        reunited,
        closed,
      },
      byType: {
        lost,
        found,
      },
      totalViews: totalViews._sum.viewCount ?? 0,
    };
  }

  async getPostById(id: string) {
    const result = await this.prisma.petPost.updateMany({
      where: {
        id,
        status: { in: this.publicStatuses },
      },
      data: {
        viewCount: { increment: 1 },
      },
    });

    if (result.count === 0) {
      throw new NotFoundException('Post not found');
    }

    return this.prisma.petPost.findFirst({
      where: {
        id,
        status: { in: this.publicStatuses },
      },
      include: this.postInclude,
    });
  }

  async updatePost(id: string, userId: string, dto: UpdatePostDto) {
    const existing = await this.getOwnedPost(id, userId);

    if (dto.petId && dto.petId !== existing.petId) {
      const pet = await this.prisma.pet.findFirst({
        where: {
          id: dto.petId,
          ownerId: userId,
        },
      });

      if (!pet) {
        throw new NotFoundException('Pet not found');
      }
    }

    const data: Prisma.PetPostUncheckedUpdateInput = {};

    if (dto.petId !== undefined) data.petId = dto.petId;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.petName !== undefined) data.petName = dto.petName;
    if (dto.petType !== undefined) data.petType = dto.petType;
    if (dto.breed !== undefined) data.breed = dto.breed;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.color !== undefined) data.color = dto.color;
    if (dto.distinctiveFeatures !== undefined) {
      data.distinctiveFeatures = dto.distinctiveFeatures;
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.eventDate !== undefined) {
      data.eventDate = new Date(dto.eventDate);
    }
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.province !== undefined) data.province = dto.province;
    if (dto.district !== undefined) data.district = dto.district;
    if (dto.subdistrict !== undefined) {
      data.subdistrict = dto.subdistrict;
    }
    if (dto.locationDescription !== undefined) {
      data.locationDescription = dto.locationDescription;
    }
    if (dto.rewardAmount !== undefined) {
      data.rewardAmount = dto.rewardAmount;
    }
    if (dto.currentLocation !== undefined) {
      data.currentLocation = dto.currentLocation;
    }
    if (dto.contactPhone !== undefined) {
      data.contactPhone = dto.contactPhone;
    }
    if (dto.contactLineId !== undefined) {
      data.contactLineId = dto.contactLineId;
    }
    if (dto.contactEmail !== undefined) {
      data.contactEmail = dto.contactEmail;
    }

    if (Object.keys(data).length === 0) {
      throw new BadRequestException('No update fields provided');
    }

    return this.prisma.petPost.update({
      where: { id },
      data,
      include: this.postInclude,
    });
  }

  async changeStatus(id: string, userId: string, status: PostStatus) {
    await this.getOwnedPost(id, userId);

    if (status === PostStatus.DELETED) {
      throw new BadRequestException('Use DELETE /posts/:id to delete a post');
    }

    return this.prisma.petPost.update({
      where: { id },
      data: {
        status,
        reunitedAt: status === PostStatus.REUNITED ? new Date() : null,
      },
      include: this.postInclude,
    });
  }

  async deletePost(id: string, userId: string) {
    await this.getOwnedPost(id, userId);

    await this.prisma.petPost.update({
      where: { id },
      data: {
        status: PostStatus.DELETED,
      },
    });

    return {
      id,
      message: 'Post deleted',
    };
  }

  async uploadPostImages(
    postId: string,
    userId: string,
    files: Express.Multer.File[],
  ) {
    await this.getOwnedPost(postId, userId);

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

    const startingSortOrder = await this.prisma.postImage.count({
      where: { postId },
    });

    const imageUrls = await Promise.all(
      files.map((file) => this.cloudinary.upload(file)),
    );

    await this.prisma.$transaction(
      imageUrls.map((imageUrl, index) =>
        this.prisma.postImage.create({
          data: {
            postId,
            imageUrl,
            sortOrder: startingSortOrder + index,
          },
        }),
      ),
    );

    return this.getOwnedPost(postId, userId);
  }

  async deletePostImage(postId: string, imageId: string, userId: string) {
    await this.getOwnedPost(postId, userId);

    const image = await this.prisma.postImage.findFirst({
      where: {
        id: imageId,
        postId,
      },
      select: {
        id: true,
        cloudinaryPublicId: true,
        cloudinaryResourceType: true,
      },
    });

    if (!image) {
      throw new NotFoundException('Post image not found');
    }

    await this.prisma.$transaction([
      this.prisma.imageEmbedding.deleteMany({
        where: { postImageId: imageId },
      }),
      this.prisma.postImage.delete({
        where: { id: imageId },
      }),
    ]);

    if (image.cloudinaryPublicId) {
      await this.cloudinary.deleteAsset(
        image.cloudinaryPublicId,
        // image.cloudinaryResourceType ?? 'image',
      );
    }

    return {
      imageId,
      message: 'Post image deleted',
    };
  }

  private async getOwnedPost(id: string, userId: string) {
    const post = await this.prisma.petPost.findFirst({
      where: {
        id,
        userId,
        status: { not: PostStatus.DELETED },
      },
      include: this.postInclude,
    });

    if (!post) {
      throw new NotFoundException('Post not found or you do not own this post');
    }

    return post;
  }

  private async paginate(where: Prisma.PetPostWhereInput, query: PostQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.petPost.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: this.postInclude,
      }),
      this.prisma.petPost.count({ where }),
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
}
