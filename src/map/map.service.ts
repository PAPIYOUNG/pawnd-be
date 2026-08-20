import { BadRequestException, Injectable } from '@nestjs/common';

import { Prisma } from '@/database/generated/prisma/client';
import {
  PetType,
  PostStatus,
  PostType,
} from '@/database/generated/prisma/enums';
import { PrismaService } from '@/database/prisma.service';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { NearbyPostQueryDto } from './dto/nearby-post-query.dto';

const EARTH_RADIUS_KM = 6371.0088;
const MINIMUM_COSINE = 1e-12;

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

export type NearbyMapPostProperties = MapPostProperties & {
  distanceKm: number;
};

export type NearbyMapPostFeature = {
  type: 'Feature';
  geometry: {
    type: 'Point';
    coordinates: [number, number];
  };
  properties: NearbyMapPostProperties;
};

export type NearbyMapPostFeatureCollection = {
  type: 'FeatureCollection';
  features: NearbyMapPostFeature[];
};

type NearbyPostRow = {
  id: string;
  type: PostType;
  petName: string | null;
  petType: PetType;
  breed: string | null;
  latitude: number | string | Prisma.Decimal;
  longitude: number | string | Prisma.Decimal;
  province: string | null;
  district: string | null;
  eventDate: Date | string;
  createdAt: Date | string;
  thumbnailUrl: string | null;
  distanceKm: number | string | Prisma.Decimal;
};

@Injectable()
export class MapService {
  constructor(private readonly prisma: PrismaService) {}

  async getNearbyPosts(
    query: NearbyPostQueryDto,
  ): Promise<NearbyMapPostFeatureCollection> {
    const radiusKm = query.radiusKm ?? 10;
    const limit = query.limit ?? 20;
    const bounds = this.calculateBoundingBox(
      query.latitude,
      query.longitude,
      radiusKm,
    );
    const typeFilter = query.type
      ? Prisma.sql`AND p.type = ${query.type}::"post_type"`
      : Prisma.empty;
    const petTypeFilter = query.petType
      ? Prisma.sql`AND p.pet_type = ${query.petType}::"pet_type"`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<NearbyPostRow[]>(Prisma.sql`
      WITH candidates AS (
        SELECT
          p.id,
          p.type,
          p.pet_name AS "petName",
          p.pet_type AS "petType",
          p.breed,
          p.latitude::double precision AS latitude,
          p.longitude::double precision AS longitude,
          p.province,
          p.district,
          p.event_date AS "eventDate",
          p.created_at AS "createdAt",
          first_image."thumbnailUrl",
          ${EARTH_RADIUS_KM}::double precision * ACOS(
            LEAST(
              1.0,
              GREATEST(
                -1.0,
                COS(RADIANS(${query.latitude}::double precision))
                  * COS(RADIANS(p.latitude::double precision))
                  * COS(
                    RADIANS(
                      p.longitude::double precision
                        - ${query.longitude}::double precision
                    )
                  )
                  + SIN(RADIANS(${query.latitude}::double precision))
                    * SIN(RADIANS(p.latitude::double precision))
              )
            )
          ) AS "distanceKm"
        FROM pet_posts AS p
        LEFT JOIN LATERAL (
          SELECT pi.image_url AS "thumbnailUrl"
          FROM post_images AS pi
          WHERE pi.post_id = p.id
          ORDER BY pi.sort_order ASC, pi.id ASC
          LIMIT 1
        ) AS first_image ON TRUE
        WHERE p.status = ${PostStatus.ACTIVE}::"post_status"
          AND p.latitude
            BETWEEN ${bounds.minLatitude}::numeric
              AND ${bounds.maxLatitude}::numeric
          AND p.longitude
            BETWEEN ${bounds.minLongitude}::numeric
              AND ${bounds.maxLongitude}::numeric
          ${typeFilter}
          ${petTypeFilter}
      )
      SELECT *
      FROM candidates
      WHERE "distanceKm" <= ${radiusKm}::double precision
      ORDER BY "distanceKm" ASC, "createdAt" DESC, id ASC
      LIMIT ${limit}
    `);

    return {
      type: 'FeatureCollection',
      features: rows.map((row) => ({
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [
            this.toRoundedNumber(row.longitude, 3),
            this.toRoundedNumber(row.latitude, 3),
          ],
        },
        properties: {
          id: row.id,
          postType: row.type,
          petName: row.petName,
          petType: row.petType,
          breed: row.breed,
          province: row.province,
          district: row.district,
          eventDate: this.toIsoString(row.eventDate),
          createdAt: this.toIsoString(row.createdAt),
          thumbnailUrl: row.thumbnailUrl ?? null,
          distanceKm: this.toRoundedNumber(row.distanceKm, 2),
        },
      })),
    };
  }

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

  private calculateBoundingBox(
    latitude: number,
    longitude: number,
    radiusKm: number,
  ): {
    minLatitude: number;
    maxLatitude: number;
    minLongitude: number;
    maxLongitude: number;
  } {
    const latitudeDelta = (radiusKm / EARTH_RADIUS_KM) * (180 / Math.PI);
    const cosine = Math.max(
      Math.abs(Math.cos((latitude * Math.PI) / 180)),
      MINIMUM_COSINE,
    );
    const longitudeDelta = Math.min(180, latitudeDelta / cosine);
    const usesFullLongitudeRange = longitudeDelta === 180;

    return {
      minLatitude: Math.max(-90, latitude - latitudeDelta),
      maxLatitude: Math.min(90, latitude + latitudeDelta),
      minLongitude: usesFullLongitudeRange
        ? -180
        : Math.max(-180, longitude - longitudeDelta),
      maxLongitude: usesFullLongitudeRange
        ? 180
        : Math.min(180, longitude + longitudeDelta),
    };
  }

  private toRoundedNumber(
    value: number | string | Prisma.Decimal,
    decimalPlaces: number,
  ): number {
    const numericValue =
      typeof value === 'number'
        ? value
        : typeof value === 'string'
          ? Number(value)
          : value.toNumber();

    return Number(numericValue.toFixed(decimalPlaces));
  }

  private toIsoString(value: Date | string): string {
    return value instanceof Date
      ? value.toISOString()
      : new Date(value).toISOString();
  }
}
