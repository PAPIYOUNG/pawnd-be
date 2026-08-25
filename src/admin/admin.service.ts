import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import { UpdateCommentVisibilityDto } from '@/admin/dto/update-comment-visibility.dto';
import { ReviewReportDto } from '@/admin/dto/review-report.dto';

export interface MonthlyTrendPoint {
  month: number;
  lost: number;
  found: number;
  reunited: number;
}

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

  async monthlyTrend(year: number): Promise<MonthlyTrendPoint[]> {
    const startOfYear = new Date(Date.UTC(year, 0, 1));
    const startOfNextYear = new Date(Date.UTC(year + 1, 0, 1));

    const [lostPosts, foundPosts, reunitedPosts] = await Promise.all([
      this.prisma.petPost.findMany({
        where: {
          type: PostType.LOST,
          createdAt: { gte: startOfYear, lt: startOfNextYear },
        },
        select: { createdAt: true },
      }),
      this.prisma.petPost.findMany({
        where: {
          type: PostType.FOUND,
          createdAt: { gte: startOfYear, lt: startOfNextYear },
        },
        select: { createdAt: true },
      }),
      this.prisma.petPost.findMany({
        where: {
          status: PostStatus.REUNITED,
          reunitedAt: { gte: startOfYear, lt: startOfNextYear },
        },
        select: { reunitedAt: true },
      }),
    ]);

    const trend: MonthlyTrendPoint[] = Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      lost: 0,
      found: 0,
      reunited: 0,
    }));

    for (const post of lostPosts) {
      trend[post.createdAt.getUTCMonth()].lost += 1;
    }
    for (const post of foundPosts) {
      trend[post.createdAt.getUTCMonth()].found += 1;
    }
    for (const post of reunitedPosts) {
      if (post.reunitedAt) {
        trend[post.reunitedAt.getUTCMonth()].reunited += 1;
      }
    }

    return trend;
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

    if (dto.status !== UserStatus.ACTIVE) {
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

  async getPostById(id: string) {
    const matchedPostSelect = {
      id: true,
      petName: true,
      petType: true,
      breed: true,
      type: true,
      status: true,
      images: {
        orderBy: { sortOrder: 'asc' as const },
        take: 1,
        select: { imageUrl: true },
      },
    } satisfies Prisma.PetPostSelect;

    const [post, matches] = await Promise.all([
      this.prisma.petPost.findUnique({
        where: { id },
        select: {
          id: true,
          type: true,
          status: true,
          petName: true,
          petType: true,
          breed: true,
          gender: true,
          color: true,
          distinctiveFeatures: true,
          description: true,
          eventDate: true,
          latitude: true,
          longitude: true,
          province: true,
          district: true,
          subdistrict: true,
          locationDescription: true,
          rewardAmount: true,
          currentLocation: true,
          contactPhone: true,
          contactLineId: true,
          contactEmail: true,
          viewCount: true,
          reunitedAt: true,
          createdAt: true,
          updatedAt: true,
          user: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          pet: {
            select: { id: true, name: true },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
            select: { id: true, imageUrl: true, sortOrder: true },
          },
        },
      }),
      this.prisma.aiMatch.findMany({
        where: { OR: [{ lostPostId: id }, { foundPostId: id }] },
        orderBy: { finalScore: 'desc' },
        select: {
          id: true,
          lostPostId: true,
          vectorSimilarity: true,
          featureScore: true,
          locationScore: true,
          dateScore: true,
          finalScore: true,
          distanceKm: true,
          isNotified: true,
          createdAt: true,
          lostPost: { select: matchedPostSelect },
          foundPost: { select: matchedPostSelect },
        },
      }),
    ]);

    if (!post) {
      throw new NotFoundException('Post not found');
    }

    const aiMatches = matches.map((match) => ({
      matchId: match.id,
      finalScore: match.finalScore,
      vectorSimilarity: match.vectorSimilarity,
      featureScore: match.featureScore,
      locationScore: match.locationScore,
      dateScore: match.dateScore,
      distanceKm: match.distanceKm,
      isNotified: match.isNotified,
      createdAt: match.createdAt,
      matchedPost: match.lostPostId === id ? match.foundPost : match.lostPost,
    }));

    return { post, aiMatches };
  }

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

  async updateCommentVisibility(id: string, dto: UpdateCommentVisibilityDto) {
    const existingComment = await this.prisma.communityComment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    const comment = await this.prisma.communityComment.update({
      where: { id },
      data: { isHidden: dto.isHidden },
      select: {
        id: true,
        communityPostId: true,
        userId: true,
        isHidden: true,
        updatedAt: true,
      },
    });

    this.adminGateway.broadcastCommentUpdated(comment);

    return { comment };
  }

  async deleteComment(id: string) {
    const existingComment = await this.prisma.communityComment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existingComment) {
      throw new NotFoundException('Comment not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.contentReport.deleteMany({ where: { commentId: id } });
      await tx.communityComment.delete({ where: { id } });
    });

    this.adminGateway.broadcastCommentDeleted({ id });

    return { message: 'Comment deleted successfully' };
  }

  async getReports() {
    const reports = await this.prisma.contentReport.findMany({
      include: {
        reporter: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },

        communityPost: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
            images: true,
          },
        },

        comment: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },

        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },

      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      totalReports: reports.length,
      reports,
    };
  }
  async reviewReport(reportId: string, dto: ReviewReportDto, adminId: string) {
    const report = await this.prisma.contentReport.findUnique({
      where: {
        id: reportId,
      },
    });

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Report has already been reviewed');
    }

    await this.prisma.$transaction(async (tx) => {
      if (dto.hideContent) {
        if (report.communityPostId) {
          await tx.communityPost.update({
            where: {
              id: report.communityPostId,
            },
            data: {
              isHidden: true,
            },
          });
        }

        if (report.commentId) {
          await tx.communityComment.update({
            where: {
              id: report.commentId,
            },
            data: {
              isHidden: true,
            },
          });
        }
      }

      await tx.contentReport.update({
        where: {
          id: reportId,
        },

        data: {
          status: dto.status,
          reviewedBy: adminId,
          reviewedAt: new Date(),
        },
      });
    });

    const updatedReport = await this.prisma.contentReport.findUnique({
      where: {
        id: reportId,
      },
    });

    this.adminGateway.broadcastReportUpdated(updatedReport);

    return {
      report: updatedReport,
    };
  }
}
