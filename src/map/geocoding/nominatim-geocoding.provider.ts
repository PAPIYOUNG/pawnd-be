import {
  BadGatewayException,
  GatewayTimeoutException,
  Inject,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import z from 'zod';

import type { EnvVariableType } from '@/config/env.validate';
import {
  GEOCODING_CLOCK,
  GEOCODING_SLEEPER,
  NOMINATIM_FETCH,
} from './geocoding-provider';
import type {
  GeocodingClock,
  GeocodingFetch,
  GeocodingProvider,
  GeocodingSleeper,
  ReverseGeocodeInput,
  ReverseGeocodeResult,
} from './geocoding-provider';

const REQUEST_INTERVAL_MS = 1_000;
const CACHE_TTL_MS = 24 * 60 * 60 * 1_000;
const CACHE_LIMIT = 1_000;
const COORDINATE_DECIMAL_PLACES = 5;

const nominatimAddressSchema = z.object({
  road: z.string().nullable().optional(),
  pedestrian: z.string().nullable().optional(),
  neighbourhood: z.string().nullable().optional(),
  quarter: z.string().nullable().optional(),
  suburb: z.string().nullable().optional(),
  municipality: z.string().nullable().optional(),
  town: z.string().nullable().optional(),
  village: z.string().nullable().optional(),
  county: z.string().nullable().optional(),
  city_district: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  province: z.string().nullable().optional(),
  region: z.string().nullable().optional(),
  postcode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  country_code: z.string().nullable().optional(),
});

const nominatimResultSchema = z.object({
  display_name: z.string().min(1),
  address: nominatimAddressSchema,
});

const nominatimNotFoundSchema = z.object({
  error: z.string().min(1),
});

type CacheEntry = {
  expiresAt: number;
  value: ReverseGeocodeResult;
};

@Injectable()
export class NominatimGeocodingProvider implements GeocodingProvider {
  private readonly baseUrl: string;
  private readonly userAgent: string;
  private readonly timeoutMs: number;
  private readonly cache = new Map<string, CacheEntry>();
  private queue: Promise<void> = Promise.resolve();
  private lastRequestStartedAt: number | null = null;

  constructor(
    configService: ConfigService<EnvVariableType, true>,
    @Inject(NOMINATIM_FETCH) private readonly fetcher: GeocodingFetch,
    @Inject(GEOCODING_CLOCK) private readonly clock: GeocodingClock,
    @Inject(GEOCODING_SLEEPER) private readonly sleeper: GeocodingSleeper,
  ) {
    this.baseUrl = configService.get('NOMINATIM_BASE_URL', { infer: true });
    this.userAgent = configService.get('NOMINATIM_USER_AGENT', { infer: true });
    this.timeoutMs = configService.get('NOMINATIM_TIMEOUT_MS', { infer: true });
  }

  reverseGeocode(input: ReverseGeocodeInput): Promise<ReverseGeocodeResult> {
    const normalizedInput = this.normalizeInput(input);
    const cacheKey = this.createCacheKey(normalizedInput);
    const cached = this.getCached(cacheKey);

    if (cached) {
      return Promise.resolve(cached);
    }

    const operation = this.queue.then(async () => {
      const cachedInsideQueue = this.getCached(cacheKey);
      if (cachedInsideQueue) {
        return cachedInsideQueue;
      }

      await this.waitForRateLimit();
      this.lastRequestStartedAt = this.clock.now();

      const result = await this.requestProvider(normalizedInput);
      this.setCached(cacheKey, result);
      return result;
    });

    this.queue = operation.then(
      () => undefined,
      () => undefined,
    );

    return operation;
  }

  private normalizeInput(input: ReverseGeocodeInput): ReverseGeocodeInput {
    return {
      latitude: Number(input.latitude.toFixed(COORDINATE_DECIMAL_PLACES)),
      longitude: Number(input.longitude.toFixed(COORDINATE_DECIMAL_PLACES)),
      language: input.language,
    };
  }

  private createCacheKey(input: ReverseGeocodeInput): string {
    return [
      input.latitude.toFixed(COORDINATE_DECIMAL_PLACES),
      input.longitude.toFixed(COORDINATE_DECIMAL_PLACES),
      input.language,
    ].join(':');
  }

  private getCached(key: string): ReverseGeocodeResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) {
      return undefined;
    }

    if (entry.expiresAt <= this.clock.now()) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  private setCached(key: string, value: ReverseGeocodeResult): void {
    if (this.cache.size >= CACHE_LIMIT) {
      const oldestKey = this.cache.keys().next().value as string | undefined;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      expiresAt: this.clock.now() + CACHE_TTL_MS,
      value,
    });
  }

  private async waitForRateLimit(): Promise<void> {
    if (this.lastRequestStartedAt === null) {
      return;
    }

    const elapsed = this.clock.now() - this.lastRequestStartedAt;
    const delay = Math.max(0, REQUEST_INTERVAL_MS - elapsed);
    if (delay > 0) {
      await this.sleeper.sleep(delay);
    }
  }

  private async requestProvider(
    input: ReverseGeocodeInput,
  ): Promise<ReverseGeocodeResult> {
    const url = new URL(`${this.baseUrl.replace(/\/+$/, '')}/reverse`);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('lat', input.latitude.toString());
    url.searchParams.set('lon', input.longitude.toString());
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', input.language);

    const abortController = new AbortController();
    const timeout = setTimeout(() => abortController.abort(), this.timeoutMs);

    try {
      const response = await this.fetcher(url, {
        headers: {
          'User-Agent': this.userAgent,
          Accept: 'application/json',
        },
        signal: abortController.signal,
      });

      if (response.status === 404) {
        throw new NotFoundException('Address not found');
      }
      if (response.status === 429 || response.status >= 500) {
        throw new ServiceUnavailableException(
          'Reverse geocoding is temporarily unavailable',
        );
      }
      if (!response.ok) {
        throw new BadGatewayException('Reverse geocoding provider failed');
      }

      const payload: unknown = await response.json();
      if (nominatimNotFoundSchema.safeParse(payload).success) {
        throw new NotFoundException('Address not found');
      }

      const parsed = nominatimResultSchema.safeParse(payload);
      if (!parsed.success) {
        throw new BadGatewayException(
          'Reverse geocoding provider returned an invalid response',
        );
      }

      return this.mapResult(parsed.data);
    } catch (error: unknown) {
      if (
        error instanceof NotFoundException ||
        error instanceof ServiceUnavailableException ||
        error instanceof BadGatewayException
      ) {
        throw error;
      }
      if (this.isAbortError(error)) {
        throw new GatewayTimeoutException('Reverse geocoding timed out');
      }
      throw new BadGatewayException('Reverse geocoding provider failed');
    } finally {
      clearTimeout(timeout);
    }
  }

  private mapResult(
    result: z.infer<typeof nominatimResultSchema>,
  ): ReverseGeocodeResult {
    const address = result.address;

    return {
      displayName: result.display_name,
      address: {
        road: address.road ?? address.pedestrian ?? null,
        neighbourhood: address.neighbourhood ?? address.quarter ?? null,
        subdistrict:
          address.suburb ??
          address.municipality ??
          address.town ??
          address.village ??
          null,
        district:
          address.county ?? address.city_district ?? address.city ?? null,
        province: address.province ?? address.state ?? address.region ?? null,
        postcode: address.postcode ?? null,
        country: address.country ?? null,
        countryCode: address.country_code ?? null,
      },
      source: 'nominatim',
      attribution: 'Data © OpenStreetMap contributors',
    };
  }

  private isAbortError(error: unknown): boolean {
    return (
      (error instanceof Error || error instanceof DOMException) &&
      error.name === 'AbortError'
    );
  }
}
