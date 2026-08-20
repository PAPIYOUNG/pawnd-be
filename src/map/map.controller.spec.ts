import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { PetType, PostType } from '@/database/generated/prisma/enums';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { NearbyPostQueryDto } from './dto/nearby-post-query.dto';
import { MapController } from './map.controller';
import {
  MapPostFeatureCollection,
  MapService,
  NearbyMapPostFeatureCollection,
} from './map.service';

jest.mock('@/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('MapController', () => {
  const getMapPosts = jest.fn();
  const getNearbyPosts = jest.fn();
  const mapService = { getMapPosts, getNearbyPosts };
  let controller: MapController;

  const query: MapPostQueryDto = {
    south: 13,
    west: 100,
    north: 14,
    east: 101,
    limit: 100,
  };
  const featureCollection: MapPostFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        geometry: {
          type: 'Point',
          coordinates: [100.502, 13.756],
        },
        properties: {
          id: '00000000-0000-4000-8000-000000000001',
          postType: PostType.LOST,
          petName: 'Lucky',
          petType: PetType.DOG,
          breed: 'Golden Retriever',
          province: 'Bangkok',
          district: 'Pathum Wan',
          eventDate: '2026-08-18T10:00:00.000Z',
          createdAt: '2026-08-18T11:00:00.000Z',
          thumbnailUrl: 'https://example.com/lucky.jpg',
        },
      },
    ],
  };
  const nearbyQuery: NearbyPostQueryDto = {
    latitude: 13.756,
    longitude: 100.502,
    radiusKm: 10,
    limit: 20,
  };
  const nearbyFeatureCollection: NearbyMapPostFeatureCollection = {
    type: 'FeatureCollection',
    features: [
      {
        ...featureCollection.features[0],
        properties: {
          ...featureCollection.features[0].properties,
          distanceKm: 2.34,
        },
      },
    ],
  };

  beforeEach(() => {
    jest.resetAllMocks();
    controller = new MapController(mapService as unknown as MapService);
  });

  it('delegates the query to MapService', async () => {
    getMapPosts.mockResolvedValue(featureCollection);

    await controller.getMapPosts(query);

    expect(getMapPosts).toHaveBeenCalledWith(query);
  });

  it('returns the result from MapService', async () => {
    getMapPosts.mockResolvedValue(featureCollection);

    await expect(controller.getMapPosts(query)).resolves.toBe(
      featureCollection,
    );
  });

  it('marks the endpoint as public', () => {
    const descriptor = Object.getOwnPropertyDescriptor(
      MapController.prototype,
      'getMapPosts',
    ) as TypedPropertyDescriptor<MapController['getMapPosts']>;

    expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value!)).toBe(true);
  });

  describe('getNearbyPosts', () => {
    it('delegates the query to MapService', async () => {
      getNearbyPosts.mockResolvedValue(nearbyFeatureCollection);

      await controller.getNearbyPosts(nearbyQuery);

      expect(getNearbyPosts).toHaveBeenCalledWith(nearbyQuery);
    });

    it('returns the result from MapService', async () => {
      getNearbyPosts.mockResolvedValue(nearbyFeatureCollection);

      await expect(controller.getNearbyPosts(nearbyQuery)).resolves.toBe(
        nearbyFeatureCollection,
      );
    });

    it('marks the endpoint as public', () => {
      const descriptor = Object.getOwnPropertyDescriptor(
        MapController.prototype,
        'getNearbyPosts',
      ) as TypedPropertyDescriptor<MapController['getNearbyPosts']>;

      expect(Reflect.getMetadata(IS_PUBLIC_KEY, descriptor.value!)).toBe(true);
    });
  });
});
