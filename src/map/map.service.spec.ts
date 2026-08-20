import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

import { Prisma } from '@/database/generated/prisma/client';
import {
  PetType,
  PostStatus,
  PostType,
} from '@/database/generated/prisma/enums';
import type { PrismaService } from '@/database/prisma.service';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { NearbyPostQueryDto } from './dto/nearby-post-query.dto';
import { MapService } from './map.service';

jest.mock('@/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('MapPostQueryDto', () => {
  const validQuery = {
    south: '13',
    west: '100',
    north: '14',
    east: '101',
  };

  it('transforms coordinates and applies the default limit', async () => {
    const dto = plainToInstance(MapPostQueryDto, validQuery);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      south: 13,
      west: 100,
      north: 14,
      east: 101,
      limit: 100,
    });
  });

  it.each([
    ['south latitude', { south: '-91' }],
    ['north latitude', { north: '91' }],
    ['west longitude', { west: '-181' }],
    ['east longitude', { east: '181' }],
    ['post type', { type: 'UNKNOWN' }],
    ['pet type', { petType: 'HORSE' }],
    ['minimum limit', { limit: '0' }],
    ['maximum limit', { limit: '201' }],
    ['integer limit', { limit: '1.5' }],
  ])('rejects an invalid %s', async (_caseName, invalidValue) => {
    const dto = plainToInstance(MapPostQueryDto, {
      ...validQuery,
      ...invalidValue,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('NearbyPostQueryDto', () => {
  const validQuery = {
    latitude: '13.756',
    longitude: '100.502',
  };

  it('transforms coordinates and applies nearby defaults', async () => {
    const dto = plainToInstance(NearbyPostQueryDto, validQuery);

    await expect(validate(dto)).resolves.toHaveLength(0);
    expect(dto).toMatchObject({
      latitude: 13.756,
      longitude: 100.502,
      radiusKm: 10,
      limit: 20,
    });
  });

  it.each([
    ['latitude below range', { latitude: '-91' }],
    ['latitude above range', { latitude: '91' }],
    ['longitude below range', { longitude: '-181' }],
    ['longitude above range', { longitude: '181' }],
    ['radius below range', { radiusKm: '0.09' }],
    ['radius above range', { radiusKm: '50.1' }],
    ['limit below range', { limit: '0' }],
    ['limit above range', { limit: '101' }],
    ['non-integer limit', { limit: '1.5' }],
    ['post type', { type: 'UNKNOWN' }],
    ['pet type', { petType: 'HORSE' }],
  ])('rejects an invalid %s', async (_caseName, invalidValue) => {
    const dto = plainToInstance(NearbyPostQueryDto, {
      ...validQuery,
      ...invalidValue,
    });

    expect(await validate(dto)).not.toHaveLength(0);
  });
});

describe('MapService', () => {
  const findMany = jest.fn();
  const queryRaw = jest.fn<(query: Prisma.Sql) => Promise<unknown[]>>();
  let capturedRawQuery: Prisma.Sql | undefined;
  const prisma = {
    petPost: {
      findMany,
    },
    $queryRaw: queryRaw,
  };
  let service: MapService;

  const baseQuery: MapPostQueryDto = {
    south: 13,
    west: 100,
    north: 14,
    east: 101,
    limit: 100,
  };
  const nearbyQuery: NearbyPostQueryDto = {
    latitude: 13.756,
    longitude: 100.502,
    radiusKm: 10,
    limit: 20,
  };

  const post = {
    id: '00000000-0000-4000-8000-000000000001',
    type: PostType.LOST,
    petName: 'Lucky',
    petType: PetType.DOG,
    breed: 'Golden Retriever',
    latitude: new Prisma.Decimal('13.75649'),
    longitude: new Prisma.Decimal('100.50151'),
    province: 'Bangkok',
    district: 'Pathum Wan',
    eventDate: new Date('2026-08-18T10:00:00.000Z'),
    createdAt: new Date('2026-08-18T11:00:00.000Z'),
    images: [{ imageUrl: 'https://example.com/lucky.jpg' }],
  };
  const nearbyPost = {
    id: post.id,
    type: post.type,
    petName: post.petName,
    petType: post.petType,
    breed: post.breed,
    latitude: new Prisma.Decimal('13.75649'),
    longitude: new Prisma.Decimal('100.50151'),
    province: post.province,
    district: post.district,
    eventDate: '2026-08-18T10:00:00.000Z',
    createdAt: new Date('2026-08-18T11:00:00.000Z'),
    thumbnailUrl: 'https://example.com/lucky.jpg',
    distanceKm: new Prisma.Decimal('2.345'),
  };

  function getRawQuery(): Prisma.Sql {
    if (!capturedRawQuery) {
      throw new Error('Expected a raw query to be captured');
    }

    return capturedRawQuery;
  }

  function getNormalizedSql(): string {
    return getRawQuery().text.replace(/\s+/g, ' ').trim();
  }

  beforeEach(() => {
    jest.resetAllMocks();
    capturedRawQuery = undefined;
    findMany.mockResolvedValue([]);
    queryRaw.mockImplementation((query) => {
      capturedRawQuery = query;
      return Promise.resolve([]);
    });
    service = new MapService(prisma as unknown as PrismaService);
  });

  describe('getNearbyPosts', () => {
    it('uses parameterized $queryRaw with a Prisma SQL object', async () => {
      await service.getNearbyPosts(nearbyQuery);

      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(getRawQuery()).toBeInstanceOf(Prisma.Sql);
    });

    it('filters ACTIVE posts with a bounding box and final radius check', async () => {
      await service.getNearbyPosts(nearbyQuery);

      const sql = getNormalizedSql();
      expect(sql).toMatch(/p\.status = \$\d+::"post_status"/);
      expect(sql).not.toContain('p.latitude::double precision BETWEEN');
      expect(sql).not.toContain('p.longitude::double precision BETWEEN');
      expect(sql).toMatch(
        /p\.latitude BETWEEN \$\d+::numeric AND \$\d+::numeric/,
      );
      expect(sql).toMatch(
        /p\.longitude BETWEEN \$\d+::numeric AND \$\d+::numeric/,
      );
      expect(sql).toMatch(/WHERE "distanceKm" <= \$\d+::double precision/);
      expect(getRawQuery().values).toContain(PostStatus.ACTIVE);
    });

    it('parameterizes latitude, longitude, radius, and limit', async () => {
      await service.getNearbyPosts(nearbyQuery);

      const rawQuery = getRawQuery();
      expect(rawQuery.values).toEqual(
        expect.arrayContaining([13.756, 100.502, 10, 20]),
      );
      expect(rawQuery.text).not.toContain('13.756');
      expect(rawQuery.text).not.toContain('100.502');
    });

    it('adds parameterized enum filters when supplied', async () => {
      await service.getNearbyPosts({
        ...nearbyQuery,
        type: PostType.FOUND,
        petType: PetType.CAT,
      });

      const sql = getNormalizedSql();
      expect(sql).toMatch(/p\.type = \$\d+::"post_type"/);
      expect(sql).toMatch(/p\.pet_type = \$\d+::"pet_type"/);
      expect(getRawQuery().values).toEqual(
        expect.arrayContaining([PostType.FOUND, PetType.CAT]),
      );
    });

    it('uses clamped longitude bounds near the date line', async () => {
      await service.getNearbyPosts({
        ...nearbyQuery,
        latitude: 0,
        longitude: 179.99,
        radiusKm: 50,
      });

      expect(getRawQuery().values).toContain(180);
    });

    it('uses the full longitude range when delta reaches 180 near a pole', async () => {
      await service.getNearbyPosts({
        ...nearbyQuery,
        latitude: 90,
        longitude: 45,
        radiusKm: 50,
      });

      expect(getRawQuery().values).toEqual(expect.arrayContaining([-180, 180]));
    });

    it('protects acos and orders by distance, created date, and id before limiting', async () => {
      await service.getNearbyPosts(nearbyQuery);

      const sql = getNormalizedSql();
      expect(sql).toContain('LEAST( 1.0, GREATEST( -1.0,');
      expect(sql).toContain(
        'ORDER BY "distanceKm" ASC, "createdAt" DESC, id ASC',
      );
      expect(sql).toMatch(/LIMIT \$\d+$/);
    });

    it('maps raw rows to GeoJSON with rounded coordinates and distance', async () => {
      queryRaw.mockResolvedValue([nearbyPost]);

      const result = await service.getNearbyPosts(nearbyQuery);

      expect(result).toEqual({
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            geometry: {
              type: 'Point',
              coordinates: [100.502, 13.756],
            },
            properties: {
              id: nearbyPost.id,
              postType: PostType.LOST,
              petName: 'Lucky',
              petType: PetType.DOG,
              breed: 'Golden Retriever',
              province: 'Bangkok',
              district: 'Pathum Wan',
              eventDate: '2026-08-18T10:00:00.000Z',
              createdAt: '2026-08-18T11:00:00.000Z',
              thumbnailUrl: 'https://example.com/lucky.jpg',
              distanceKm: 2.35,
            },
          },
        ],
      });
    });

    it('returns a null thumbnail when the raw row has no image', async () => {
      queryRaw.mockResolvedValue([{ ...nearbyPost, thumbnailUrl: null }]);

      const result = await service.getNearbyPosts(nearbyQuery);

      expect(result.features[0].properties.thumbnailUrl).toBeNull();
    });

    it('propagates database errors', async () => {
      const databaseError = new Error('database unavailable');
      queryRaw.mockRejectedValue(databaseError);

      await expect(service.getNearbyPosts(nearbyQuery)).rejects.toBe(
        databaseError,
      );
    });
  });

  it('queries ACTIVE posts within all four bounds', async () => {
    await service.getMapPosts(baseQuery);

    expect(findMany).toHaveBeenCalledWith({
      where: {
        status: PostStatus.ACTIVE,
        latitude: { gte: 13, lte: 14 },
        longitude: { gte: 100, lte: 101 },
      },
      take: 100,
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
  });

  it('adds optional post type and pet type filters', async () => {
    await service.getMapPosts({
      ...baseQuery,
      type: PostType.FOUND,
      petType: PetType.CAT,
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          type: PostType.FOUND,
          petType: PetType.CAT,
        }),
      }),
    );
  });

  it('uses the default limit when limit is not supplied', async () => {
    const query = {
      ...baseQuery,
      limit: undefined,
    } as unknown as MapPostQueryDto;

    await service.getMapPosts(query);

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it('uses the caller supplied limit', async () => {
    await service.getMapPosts({ ...baseQuery, limit: 25 });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it('rejects south greater than or equal to north', async () => {
    await expect(
      service.getMapPosts({ ...baseQuery, south: 14 }),
    ).rejects.toThrow(new BadRequestException('south must be less than north'));
    expect(findMany).not.toHaveBeenCalled();
  });

  it('rejects west greater than or equal to east', async () => {
    await expect(
      service.getMapPosts({ ...baseQuery, west: 101 }),
    ).rejects.toThrow(
      new BadRequestException(
        'west must be less than east; International Date Line crossing is not supported',
      ),
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns a GeoJSON FeatureCollection', async () => {
    findMany.mockResolvedValue([post]);

    const result = await service.getMapPosts(baseQuery);

    expect(result.type).toBe('FeatureCollection');
    expect(result.features).toHaveLength(1);
    expect(result.features[0]).toMatchObject({
      type: 'Feature',
      geometry: { type: 'Point' },
    });
  });

  it('returns longitude before latitude and rounds both to three decimals', async () => {
    findMany.mockResolvedValue([post]);

    const result = await service.getMapPosts(baseQuery);

    expect(result.features[0].geometry.coordinates).toEqual([100.502, 13.756]);
    expect(result.features[0].geometry.coordinates).toEqual([
      expect.any(Number),
      expect.any(Number),
    ]);
  });

  it('maps marker properties and selects the first thumbnail', async () => {
    findMany.mockResolvedValue([post]);

    const result = await service.getMapPosts(baseQuery);

    expect(result.features[0].properties).toEqual({
      id: post.id,
      postType: PostType.LOST,
      petName: 'Lucky',
      petType: PetType.DOG,
      breed: 'Golden Retriever',
      province: 'Bangkok',
      district: 'Pathum Wan',
      eventDate: '2026-08-18T10:00:00.000Z',
      createdAt: '2026-08-18T11:00:00.000Z',
      thumbnailUrl: 'https://example.com/lucky.jpg',
    });
  });

  it('returns a null thumbnail when the post has no image', async () => {
    findMany.mockResolvedValue([{ ...post, images: [] }]);

    const result = await service.getMapPosts(baseQuery);

    expect(result.features[0].properties.thumbnailUrl).toBeNull();
  });

  it('propagates database errors', async () => {
    const databaseError = new Error('database unavailable');
    findMany.mockRejectedValue(databaseError);

    await expect(service.getMapPosts(baseQuery)).rejects.toBe(databaseError);
  });
});
