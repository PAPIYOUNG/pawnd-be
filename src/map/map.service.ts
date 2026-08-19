import { BadRequestException, Injectable } from '@nestjs/common';

import type { Prisma } from '@/database/generated/prisma/client';
import {
  PetType,
  PostStatus,
  PostType,
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { MapPostQueryDto } from './dto/map-post-query.dto';

export type MapPostProperties = {
  id: string;
  postType: PostType;
  petName: string | null;
  petType: PetType;
  breed: string | null;
  province: string | null;
  district: string | null;
  eventDate: string;
  createdAt: string;
  thumbnailUrl: string | null;
};

export type MapPostFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: MapPostProperties;
};

export type MapPostFeatureCollection = {
  type: 'FeatureCollection';
  features: MapPostFeature[];
};

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getMapPosts(query: MapPostQueryDto): Promise<MapPostFeatureCollection> {
    this.validateBounds(query);

    const posts = await this.prisma.petPost.findMany({
      where: {
        status: PostStatus.ACTIVE,
        latitude: {
          gte: query.south,
          lte: query.north,
        },
        longitude: {
          gte: query.west,
          lte: query.east,
        },
        ...(query.type ? { type: query.type } : {}),
        ...(query.petType ? { petType: query.petType } : {}),
      },
      take: query.limit ?? 100,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        type: true,
        petName: true,
        petType: true,
        breed: true,
        latitude: true,
        longitude: true,
        province: true,
        district: true,
        eventDate: true,
        createdAt: true,
        images: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { imageUrl: true },
        },
      },
    });

    return {
      type: 'FeatureCollection',
      features: posts.map((post) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            this.toPublicCoordinate(post.longitude),
            this.toPublicCoordinate(post.latitude),
          ],
        },
        properties: {
          id: post.id,
          postType: post.type,
          petName: post.petName,
          petType: post.petType,
          breed: post.breed,
          province: post.province,
          district: post.district,
          eventDate: post.eventDate.toISOString(),
          createdAt: post.createdAt.toISOString(),
          thumbnailUrl: post.images[0]?.imageUrl ?? null,
        },
      })),
    };
  }

  private validateBounds(query: MapPostQueryDto): void {
    if (query.south >= query.north) {
      throw new BadRequestException('south must be less than north');
    }

    if (query.west >= query.east) {
      throw new BadRequestException(
        'west must be less than east; International Date Line crossing is not supported',
      );
    }
  }

  private toPublicCoordinate(coordinate: Prisma.Decimal): number {
    return Number(coordinate.toFixed(3));
  }
}
