import { IS_PUBLIC_KEY } from '@/common/decorators/public.decorator';
import { PetType, PostType } from '@/database/generated/prisma/enums';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { MapController } from './map.controller';
import { MapPostFeatureCollection, MapService } from './map.service';

jest.mock('@/database/prisma.service', () => ({
  PrismaService: class PrismaService {},
}));

describe('MapController', () => {
  const getMapPosts = jest.fn();
  const mapService = { getMapPosts };
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
});
