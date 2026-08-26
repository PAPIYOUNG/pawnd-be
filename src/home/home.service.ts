import { Injectable } from '@nestjs/common';
import { PrismaService } from '@/database/prisma.service';
import {
  PostStatus,
  PostType,
  UserStatus,
} from '@/database/generated/prisma/enums';
import { GetLatestPostsDto } from './dto/get-latest-posts.dto';
import { GetReunitedPostsDto } from './dto/get-reunited-posts.dto';

@Injectable()
export class HomeService {
  constructor(private readonly prisma: PrismaService) {}

  async getSummaryStats() {
    const [totalLost, totalFound, totalReunited, totalUsers] =
      await Promise.all([
        this.prisma.petPost.count({
          where: {
            type: PostType.LOST,
            status: { notIn: [PostStatus.DELETED, PostStatus.HIDDEN] },
          },
        }),
        this.prisma.petPost.count({
          where: {
            type: PostType.FOUND,
            status: { notIn: [PostStatus.DELETED, PostStatus.HIDDEN] },
          },
        }),
        this.prisma.petPost.count({
          where: {
            status: PostStatus.REUNITED,
          },
        }),
        this.prisma.user.count({
          where: {
            status: UserStatus.ACTIVE,
          },
        }),
      ]);

    return {
      stats: {
        totalLost,
        totalFound,
        totalReunited,
        totalUsers,
      },
    };
  }

  async getLatestPosts(dto: GetLatestPostsDto) {
    const limit = dto.limit ?? 10;

    const posts = await this.prisma.petPost.findMany({
      where: {
        status: PostStatus.ACTIVE,
        ...(dto.type && { type: dto.type }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        type: true,
        petName: true,
        petType: true,
        breed: true,
        gender: true,
        color: true,
        province: true,
        createdAt: true,
        pet: {
          select: {
            name: true,
            type: true,
            breed: true,
            gender: true,
            color: true,
            profileImageUrl: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    return {
      posts: posts.map((post) => ({
        id: post.id,
        type: post.type,
        petName: post.petName || post.pet?.name || 'Unknown',
        petType: post.petType || post.pet?.type || 'OTHER',
        breed: post.breed || post.pet?.breed || null,
        gender: post.gender || post.pet?.gender || null,
        color: post.color || post.pet?.color || null,
        province: post.province || 'Unknown',
        coverImageUrl:
          post.images[0]?.imageUrl || post.pet?.profileImageUrl || null,
        createdAt: post.createdAt,
      })),
    };
  }

  async getRecentReunited(dto: GetReunitedPostsDto) {
    const limit = dto.limit ?? 6;

    const posts = await this.prisma.petPost.findMany({
      where: {
        status: PostStatus.REUNITED,
      },
      orderBy: [{ reunitedAt: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        petName: true,
        petType: true,
        breed: true,
        province: true,
        reunitedAt: true,
        updatedAt: true,
        pet: {
          select: {
            name: true,
            type: true,
            profileImageUrl: true,
          },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    return {
      posts: posts.map((post) => ({
        id: post.id,
        petName: post.petName || post.pet?.name || 'Unknown',
        petType: post.petType || post.pet?.type || 'OTHER',
        province: post.province || 'Unknown',
        reunitedAt: post.reunitedAt || post.updatedAt,
        coverImageUrl:
          post.images[0]?.imageUrl || post.pet?.profileImageUrl || null,
      })),
    };
  }

  getHomepageContent() {
    return {
      content: {
        emergencyGuides: [
          {
            id: 'guide-1',
            title:
              'คู่มือ 24 ชั่วโมงแรกเมื่อสัตว์เลี้ยงหาย (First 24 Hours Action Guide)',
            summary:
              'เริ่มสำรวจรัศมี 1 กม. ทันที พร้อมสร้างใบประกาศ WANTED ด้วย PAWND เพื่อแชร์ลง Social Network',
            category: 'LOST_GUIDE',
          },
          {
            id: 'guide-2',
            title: 'ขั้นตอนเมื่อพบสัตว์เลี้ยงพลัดหลง (Found Pet Action Steps)',
            summary:
              'ถ่ายรูปโพสต์ลงระบบ AI Smart Matching เพื่อค้นหาและแจ้งเตือนเจ้าของตัวจริงโดยอัตโนมัติ',
            category: 'FOUND_GUIDE',
          },
        ],
        featuredTips: [
          {
            id: 'tip-1',
            title: 'การติด Microchip และ QR Code Tagging',
            summary:
              'เพิ่มโอกาสพบน้องหมาน้องแมวได้เร็วขึ้น 3 เท่าด้วย Pet Profile QR Tag',
            category: 'PET_SAFETY',
          },
          {
            id: 'tip-2',
            title: 'เทคนิคการสังเกตจุดเด่นและตำหนิของสัตว์เลี้ยง',
            summary:
              'บันทึกรูปถ่ายตำหนิเฉพาะตัว เช่น ปาน หาง ลวดลาย เพื่อใช้ยืนยันความเป็นเจ้าของ',
            category: 'PET_CARE',
          },
        ],
      },
    };
  }
}
