import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import type { Prisma } from '@/database/generated/prisma/client';
import {
  PostStatus,
  PostType,
  ReportStatus,
  UserStatus,
} from '@/database/generated/prisma/enums';
import { AdminGateway } from '@/admin/admin.gateway';
import { GetUsersDto } from '@/admin/dto/get-users.dto';
import { UpdateUserStatusDto } from '@/admin/dto/update-user-status.dto';
import { GetPetsDto } from '@/admin/dto/get-pets.dto';
import { GetPostsDto } from '@/admin/dto/get-posts.dto';
import { UpdatePostStatusDto } from '@/admin/dto/update-post-status.dto';
import { UpdateCommunityPostVisibilityDto } from '@/admin/dto/update-community-post-visibility.dto';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminGateway: AdminGateway,
  ) {}

  async getDashboard() {
    const [
      totalUsers,
      activeUsers,
      pendingVerificationUsers,
      suspendedUsers,
      blacklistedUsers,
      totalPets,
      totalPosts,
      lostPosts,
      foundPosts,
      activePosts,
      reunitedPosts,
      hiddenPosts,
      totalCommunityPosts,
      hiddenCommunityPosts,
      totalCommunityComments,
      hiddenCommunityComments,
      totalReports,
      pendingReports,
      reviewedReports,
      actionTakenReports,
      recentPendingReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: UserStatus.ACTIVE } }),
      this.prisma.user.count({
        where: { status: UserStatus.PENDING_EMAIL_VERIFICATION },
      }),
      this.prisma.user.count({ where: { status: UserStatus.SUSPENDED } }),
      this.prisma.user.count({ where: { status: UserStatus.BLACKLISTED } }),
      this.prisma.pet.count(),
      this.prisma.petPost.count(),
      this.prisma.petPost.count({ where: { type: PostType.LOST } }),
      this.prisma.petPost.count({ where: { type: PostType.FOUND } }),
      this.prisma.petPost.count({ where: { status: PostStatus.ACTIVE } }),
      this.prisma.petPost.count({ where: { status: PostStatus.REUNITED } }),
      this.prisma.petPost.count({ where: { status: PostStatus.HIDDEN } }),
      this.prisma.communityPost.count(),
      this.prisma.communityPost.count({ where: { isHidden: true } }),
      this.prisma.communityComment.count(),
      this.prisma.communityComment.count({ where: { isHidden: true } }),
      this.prisma.contentReport.count(),
      this.prisma.contentReport.count({
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.contentReport.count({
        where: { status: ReportStatus.REVIEWED },
      }),
      this.prisma.contentReport.count({
        where: { status: ReportStatus.ACTION_TAKEN },
      }),
      this.prisma.contentReport.findMany({
        where: { status: ReportStatus.PENDING },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          reportType: true,
          reason: true,
          status: true,
          createdAt: true,
          reporter: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      }),
    ]);

    const dashboard = {
      users: {
        total: totalUsers,
        active: activeUsers,
        pendingVerification: pendingVerificationUsers,
        suspended: suspendedUsers,
        blacklisted: blacklistedUsers,
      },
      pets: {
        total: totalPets,
      },
      posts: {
        total: totalPosts,
        lost: lostPosts,
        found: foundPosts,
        active: activePosts,
        reunited: reunitedPosts,
        hidden: hiddenPosts,
      },
      community: {
        totalPosts: totalCommunityPosts,
        hiddenPosts: hiddenCommunityPosts,
        totalComments: totalCommunityComments,
        hiddenComments: hiddenCommunityComments,
      },
      reports: {
        total: totalReports,
        pending: pendingReports,
        reviewed: reviewedReports,
        actionTaken: actionTakenReports,
        recent: recentPendingReports,
      },
    };

    this.adminGateway.broadcastDashboardStats(dashboard);

    return dashboard;
  }

  async getUsers(dto: GetUsersDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Prisma.UserWhereInput = {
      ...(dto.status && { status: dto.status }),
      ...(dto.role && { role: dto.role }),
      ...(dto.search && {
        OR: [
          { firstName: { contains: dto.search, mode: 'insensitive' } },
          { lastName: { contains: dto.search, mode: 'insensitive' } },
          { email: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          avatarUrl: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getUserById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        address: true,
        lineId: true,
        avatarUrl: true,
        role: true,
        status: true,
        emailVerifiedAt: true,
        notificationEnabled: true,
        twoFactorEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: {
            pets: true,
            petPosts: true,
            communityPosts: true,
            submittedContentReports: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return { user };
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingUser) {
      throw new NotFoundException('User not found');
    }

    const user = await this.prisma.user.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    if (
      dto.status === UserStatus.SUSPENDED ||
      dto.status === UserStatus.BLACKLISTED
    ) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    this.adminGateway.broadcastUserStatusUpdated(user);

    return { user };
  }

  async getPets(dto: GetPetsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Prisma.PetWhereInput = {
      ...(dto.type && { type: dto.type }),
      ...(dto.search && {
        OR: [
          { name: { contains: dto.search, mode: 'insensitive' } },
          { breed: { contains: dto.search, mode: 'insensitive' } },
          {
            owner: {
              OR: [
                { firstName: { contains: dto.search, mode: 'insensitive' } },
                { lastName: { contains: dto.search, mode: 'insensitive' } },
                { email: { contains: dto.search, mode: 'insensitive' } },
              ],
            },
          },
        ],
      }),
    };

    const [pets, total] = await Promise.all([
      this.prisma.pet.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          type: true,
          breed: true,
          gender: true,
          profileImageUrl: true,
          createdAt: true,
          owner: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      }),
      this.prisma.pet.count({ where }),
    ]);

    return {
      pets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getPetById(id: string) {
    const pet = await this.prisma.pet.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        type: true,
        breed: true,
        gender: true,
        color: true,
        age: true,
        distinctiveFeatures: true,
        description: true,
        profileImageUrl: true,
        createdAt: true,
        updatedAt: true,
        owner: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          select: { id: true, imageUrl: true, isProfile: true },
        },
        qrCode: {
          select: { id: true, qrToken: true, isActive: true },
        },
      },
    });

    if (!pet) {
      throw new NotFoundException('Pet not found');
    }

    return { pet };
  }

  async getPosts(dto: GetPostsDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Prisma.PetPostWhereInput = {
      ...(dto.type && { type: dto.type }),
      ...(dto.status && { status: dto.status }),
      ...(dto.province && {
        province: { contains: dto.province, mode: 'insensitive' },
      }),
      ...(dto.search && {
        OR: [
          { petName: { contains: dto.search, mode: 'insensitive' } },
          { breed: { contains: dto.search, mode: 'insensitive' } },
          { description: { contains: dto.search, mode: 'insensitive' } },
        ],
      }),
    };

    const [posts, total] = await Promise.all([
      this.prisma.petPost.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          type: true,
          status: true,
          petName: true,
          petType: true,
          breed: true,
          province: true,
          eventDate: true,
          viewCount: true,
          createdAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            take: 1,
            select: { imageUrl: true },
          },
        },
      }),
      this.prisma.petPost.count({ where }),
    ]);

    return {
      posts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
  async updatePostStatus(id: string, dto: UpdatePostStatusDto) {
    const existingPost = await this.prisma.petPost.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Post not found');
    }

    const post = await this.prisma.petPost.update({
      where: { id },
      data: { status: dto.status },
      select: {
        id: true,
        type: true,
        status: true,
        petName: true,
        userId: true,
        updatedAt: true,
      },
    });

    this.adminGateway.broadcastPostStatusUpdated(post);

    return { post };
  }

  deletePost() {}

  async updateCommunityPostVisibility(
    id: string,
    dto: UpdateCommunityPostVisibilityDto,
  ) {
    const existingPost = await this.prisma.communityPost.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Community post not found');
    }

    const post = await this.prisma.communityPost.update({
      where: { id },
      data: { isHidden: dto.isHidden },
      select: {
        id: true,
        type: true,
        title: true,
        isHidden: true,
        userId: true,
        updatedAt: true,
      },
    });

    this.adminGateway.broadcastCommunityPostUpdated(post);

    return { post };
  }

  async deleteCommunityPost(id: string) {
    const existingPost = await this.prisma.communityPost.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingPost) {
      throw new NotFoundException('Community post not found');
    }

    await this.prisma.$transaction(async (tx) => {
      const comments = await tx.communityComment.findMany({
        where: { communityPostId: id },
        select: { id: true },
      });
      const commentIds = comments.map((comment) => comment.id);

      await tx.contentReport.deleteMany({
        where: {
          OR: [
            { communityPostId: id },
            ...(commentIds.length ? [{ commentId: { in: commentIds } }] : []),
          ],
        },
      });

      await tx.communityComment.deleteMany({ where: { communityPostId: id } });
      await tx.communityPostImage.deleteMany({
        where: { communityPostId: id },
      });
      await tx.communityPost.delete({ where: { id } });
    });

    this.adminGateway.broadcastCommunityPostDeleted({ id });

    return { message: 'Community post deleted successfully' };
  }

  updateCommentVisibility() {}
  deleteComment() {}

  getReports() {}
  reviewReport() {}
}
