/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common';

import { AiMatchingService } from './ai-matching.service';
import type { AiService } from './ai.service';
import type { EmbeddingService } from './service/embedding.service';
import type { PostEventsService } from '@/post-events/post-events.service';
import type { PrismaService } from '@/database/prisma.service';
import { PetType, PostType } from '@/database/generated/prisma/enums';

const lostPostId = '00000000-0000-4000-8000-000000000010';
const foundPostId = '00000000-0000-4000-8000-000000000011';

const analysisResult = {
  type: PetType.DOG,
  breed: 'Labrador',
  color: 'black',
  distinctiveFeatures: 'white paw',
  description: 'a black dog',
};

const uploadedFile = {
  buffer: Buffer.from('fake-image-bytes'),
  mimetype: 'image/jpeg',
} as Express.Multer.File;

const createPost = (id: string, type: PostType) => ({
  id,
  type,
  status: 'ACTIVE',
  petName: 'Buddy',
  petType: PetType.DOG,
  breed: 'Labrador',
  gender: 'MALE',
  color: 'black',
  distinctiveFeatures: 'white paw',
  description: null,
  eventDate: new Date('2026-08-20T00:00:00.000Z'),
  latitude: 13.7563,
  longitude: 100.5018,
  province: null,
  district: null,
  subdistrict: null,
  locationDescription: null,
  createdAt: new Date('2026-08-20T00:00:00.000Z'),
  images: [],
});

describe('AiMatchingService.matchByImage', () => {
  const prismaMock = {
    petPost: {
      findMany: jest.fn(),
    },
  };
  const embeddingMock = {
    generateEmbeddingFromImageSource: jest.fn(),
    findSimilarPosts: jest.fn(),
  };
  const postEventsMock = {};
  const aiServiceMock = {
    analyzeImage: jest.fn(),
  };

  let service: AiMatchingService;

  beforeEach(() => {
    jest.resetAllMocks();

    aiServiceMock.analyzeImage.mockResolvedValue(analysisResult);
    embeddingMock.generateEmbeddingFromImageSource.mockResolvedValue({
      embedding: [0.1, 0.2, 0.3],
      model: 'nvidia/llama-nemotron-embed-vl-1b-v2:free',
    });

    service = new AiMatchingService(
      prismaMock as unknown as PrismaService,
      embeddingMock as unknown as EmbeddingService,
      postEventsMock as unknown as PostEventsService,
      aiServiceMock as unknown as AiService,
    );
  });

  it('throws BadRequestException when no file is provided', async () => {
    await expect(
      service.matchByImage(undefined as unknown as Express.Multer.File, {
        limit: 10,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(aiServiceMock.analyzeImage).not.toHaveBeenCalled();
  });

  it('analyzes the image, searches by vector, and re-ranks with feature score', async () => {
    embeddingMock.findSimilarPosts.mockResolvedValue([
      { postId: lostPostId, vectorSimilarity: 0.9 },
      { postId: foundPostId, vectorSimilarity: 0.4 },
    ]);
    prismaMock.petPost.findMany.mockResolvedValue([
      createPost(lostPostId, PostType.LOST),
      createPost(foundPostId, PostType.FOUND),
    ]);

    const result = await service.matchByImage(uploadedFile, { limit: 10 });

    expect(aiServiceMock.analyzeImage).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/jpeg;base64,/),
    );
    expect(embeddingMock.generateEmbeddingFromImageSource).toHaveBeenCalledWith(
      expect.stringMatching(/^data:image\/jpeg;base64,/),
    );
    expect(embeddingMock.findSimilarPosts).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      { limit: 50, postType: undefined, petType: PetType.DOG },
    );

    expect(result.totalCandidates).toBe(2);
    expect(result.totalMatches).toBe(2);
    // Both posts share breed/color/distinctiveFeatures with the analyzed
    // image, so featureScore is 1 for both; ordering follows vectorSimilarity.
    expect(result.matches[0].postId).toBe(lostPostId);
    expect(result.matches[0].finalScore).toBeCloseTo(0.9 * 0.5 + 1 * 0.5);
    expect(result.matches[1].postId).toBe(foundPostId);
  });

  it('returns no matches when vector search finds nothing', async () => {
    embeddingMock.findSimilarPosts.mockResolvedValue([]);

    const result = await service.matchByImage(uploadedFile, { limit: 10 });

    expect(result.totalCandidates).toBe(0);
    expect(result.totalMatches).toBe(0);
    expect(result.matches).toEqual([]);
    expect(prismaMock.petPost.findMany).not.toHaveBeenCalled();
  });

  it('propagates embedding provider failures', async () => {
    const providerError = new Error('embedding provider unavailable');
    embeddingMock.generateEmbeddingFromImageSource.mockRejectedValue(
      providerError,
    );

    await expect(
      service.matchByImage(uploadedFile, { limit: 10 }),
    ).rejects.toBe(providerError);

    expect(embeddingMock.findSimilarPosts).not.toHaveBeenCalled();
  });

  it('propagates image analysis failures', async () => {
    const analysisError = new Error('analysis provider unavailable');
    aiServiceMock.analyzeImage.mockRejectedValue(analysisError);

    await expect(
      service.matchByImage(uploadedFile, { limit: 10 }),
    ).rejects.toBe(analysisError);

    expect(
      embeddingMock.generateEmbeddingFromImageSource,
    ).not.toHaveBeenCalled();
  });

  it('caps the vector-search pool size and forwards the postType filter', async () => {
    embeddingMock.findSimilarPosts.mockResolvedValue([]);

    await service.matchByImage(uploadedFile, {
      limit: 30,
      postType: PostType.FOUND,
    });

    expect(embeddingMock.findSimilarPosts).toHaveBeenCalledWith(
      [0.1, 0.2, 0.3],
      'nvidia/llama-nemotron-embed-vl-1b-v2:free',
      { limit: 100, postType: PostType.FOUND, petType: PetType.DOG },
    );
  });
});
