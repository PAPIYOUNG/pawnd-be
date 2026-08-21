import {
  BadGatewayException,
  GatewayTimeoutException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EnvVariableType } from '@/config/env.validate';
import {
  GeocodingClock,
  GeocodingFetch,
  GeocodingSleeper,
  ReverseGeocodeInput,
} from './geocoding-provider';
import { NominatimGeocodingProvider } from './nominatim-geocoding.provider';

describe('NominatimGeocodingProvider', () => {
  const validPayload = {
    place_id: 123,
    display_name: 'Sukhumvit Road, Khlong Toei, Bangkok, Thailand',
    lat: '13.73000',
    lon: '100.57000',
    address: {
      pedestrian: 'Sukhumvit Road',
      quarter: 'Nana',
      municipality: 'Khlong Toei',
      city_district: 'Khlong Toei',
      province: 'Bangkok',
      postcode: '10110',
      country: 'Thailand',
      country_code: 'th',
      ignored_provider_field: 'not returned',
    },
    ignored_provider_field: 'not returned',
  };
  const input: ReverseGeocodeInput = {
    latitude: 13.730001,
    longitude: 100.570001,
    language: 'th',
  };

  let now: number;
  let fetcher: jest.MockedFunction<GeocodingFetch>;
  let sleep: jest.MockedFunction<GeocodingSleeper['sleep']>;
  let provider: NominatimGeocodingProvider;

  const jsonResponse = (payload: unknown, status = 200): Response =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  function createProvider(timeoutMs = 5_000): NominatimGeocodingProvider {
    const values: Pick<
      EnvVariableType,
      'NOMINATIM_BASE_URL' | 'NOMINATIM_USER_AGENT' | 'NOMINATIM_TIMEOUT_MS'
    > = {
      NOMINATIM_BASE_URL: 'https://nominatim.example.test/base/',
      NOMINATIM_USER_AGENT: 'PAWND/1.0 test-suite',
      NOMINATIM_TIMEOUT_MS: timeoutMs,
    };
    const configService = {
      get: (key: keyof typeof values) => values[key],
    } as unknown as ConfigService<EnvVariableType, true>;
    const clock: GeocodingClock = { now: () => now };
    const sleeper: GeocodingSleeper = { sleep };

    return new NominatimGeocodingProvider(
      configService,
      fetcher,
      clock,
      sleeper,
    );
  }

  beforeEach(() => {
    now = 0;
    fetcher = jest.fn<ReturnType<GeocodingFetch>, Parameters<GeocodingFetch>>();
    fetcher.mockImplementation(() =>
      Promise.resolve(jsonResponse(validPayload)),
    );
    sleep = jest.fn((milliseconds: number) => {
      now += milliseconds;
      return Promise.resolve();
    });
    provider = createProvider();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('builds the reverse URL from validated inputs and normalizes coordinates', async () => {
    await provider.reverseGeocode(input);

    const [requestedUrl] = fetcher.mock.calls[0];
    const url = new URL(requestedUrl);
    expect(url.origin + url.pathname).toBe(
      'https://nominatim.example.test/base/reverse',
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: 'jsonv2',
      lat: '13.73',
      lon: '100.57',
      addressdetails: '1',
      'accept-language': 'th',
    });
  });

  it('sends the configured User-Agent and JSON Accept header', async () => {
    await provider.reverseGeocode(input);

    expect(fetcher).toHaveBeenCalledWith(
      expect.any(URL),
      expect.objectContaining({
        headers: {
          'User-Agent': 'PAWND/1.0 test-suite',
          Accept: 'application/json',
        },
      }),
    );
  });

  it('validates and maps only the PAWND response contract with fallbacks', async () => {
    const result = await provider.reverseGeocode(input);

    expect(result).toEqual({
      displayName: validPayload.display_name,
      address: {
        road: 'Sukhumvit Road',
        neighbourhood: 'Nana',
        subdistrict: 'Khlong Toei',
        district: 'Khlong Toei',
        province: 'Bangkok',
        postcode: '10110',
        country: 'Thailand',
        countryCode: 'th',
      },
      source: 'nominatim',
      attribution: 'Data © OpenStreetMap contributors',
    });
    expect(result).not.toHaveProperty('place_id');
    expect(result).not.toHaveProperty('lat');
    expect(result.address).not.toHaveProperty('ignored_provider_field');
  });

  it('prefers primary address fields and returns null for missing values', async () => {
    fetcher.mockResolvedValueOnce(
      jsonResponse({
        display_name: 'Primary fields',
        address: {
          road: 'Road',
          pedestrian: 'Pedestrian',
          neighbourhood: 'Neighbourhood',
          quarter: 'Quarter',
          suburb: 'Suburb',
          county: 'County',
          city_district: 'City district',
          state: 'State',
          province: 'Province',
        },
      }),
    );

    await expect(provider.reverseGeocode(input)).resolves.toEqual({
      displayName: 'Primary fields',
      address: {
        road: 'Road',
        neighbourhood: 'Neighbourhood',
        subdistrict: 'Suburb',
        district: 'County',
        province: 'Province',
        postcode: null,
        country: null,
        countryCode: null,
      },
      source: 'nominatim',
      attribution: 'Data © OpenStreetMap contributors',
    });
  });

  it.each([
    [
      'uses province when present',
      { province: 'Province', state: 'State', region: 'Region' },
      'Province',
    ],
    [
      'falls back to state when province is absent',
      { state: 'State', region: 'Region' },
      'State',
    ],
    [
      'falls back to region when province and state are absent',
      { region: 'Region' },
      'Region',
    ],
    [
      'returns null without using locality or district fields',
      {
        city: 'City',
        town: 'Town',
        county: 'County',
        city_district: 'City district',
      },
      null,
    ],
  ])('%s', async (_caseName, address, expectedProvince) => {
    fetcher.mockResolvedValueOnce(
      jsonResponse({
        display_name: 'Province fallback test',
        address,
      }),
    );

    const result = await provider.reverseGeocode(input);

    expect(result.address.province).toBe(expectedProvince);
  });

  it('uses the success cache for repeated normalized coordinates', async () => {
    const first = await provider.reverseGeocode(input);
    const second = await provider.reverseGeocode({
      ...input,
      latitude: 13.730002,
      longitude: 100.570002,
    });

    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('deduplicates concurrent requests by checking the cache inside the queue', async () => {
    const [first, second] = await Promise.all([
      provider.reverseGeocode(input),
      provider.reverseGeocode(input),
    ]);

    expect(second).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('separates cache entries by language', async () => {
    await provider.reverseGeocode(input);
    await provider.reverseGeocode({ ...input, language: 'en' });

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(
      new URL(fetcher.mock.calls[1][0]).searchParams.get('accept-language'),
    ).toBe('en');
  });

  it('starts queued provider requests no faster than once per second', async () => {
    const requestStartTimes: number[] = [];
    fetcher.mockImplementation(() => {
      requestStartTimes.push(now);
      return Promise.resolve(jsonResponse(validPayload));
    });

    await Promise.all([
      provider.reverseGeocode(input),
      provider.reverseGeocode({ ...input, latitude: 13.731 }),
      provider.reverseGeocode({ ...input, latitude: 13.732 }),
    ]);

    expect(requestStartTimes).toEqual([0, 1_000, 2_000]);
    expect(sleep).toHaveBeenNthCalledWith(1, 1_000);
    expect(sleep).toHaveBeenNthCalledWith(2, 1_000);
  });

  it('expires cache entries after 24 hours', async () => {
    await provider.reverseGeocode(input);
    now += 24 * 60 * 60 * 1_000;
    await provider.reverseGeocode(input);

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('evicts the oldest cache entry deterministically above 1,000 entries', async () => {
    for (let index = 0; index <= 1_000; index += 1) {
      await provider.reverseGeocode({
        ...input,
        latitude: 10 + index / 100_000,
      });
    }

    await provider.reverseGeocode({ ...input, latitude: 10 });

    expect(fetcher).toHaveBeenCalledTimes(1_002);
  });

  it('maps an aborted request to GatewayTimeoutException without retrying', async () => {
    jest.useFakeTimers();
    provider = createProvider(1_000);
    fetcher.mockImplementation((_url, init) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(new DOMException('aborted', 'AbortError'));
        });
      });
    });

    const request = provider.reverseGeocode(input);
    await jest.advanceTimersByTimeAsync(1_000);

    await expect(request).rejects.toBeInstanceOf(GatewayTimeoutException);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it.each([429, 500, 503])(
    'maps provider HTTP %s to ServiceUnavailableException',
    async (status) => {
      fetcher.mockResolvedValueOnce(jsonResponse({}, status));

      await expect(provider.reverseGeocode(input)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );

  it.each([
    ['an invalid shape', jsonResponse({ display_name: 42, address: {} })],
    [
      'malformed JSON',
      new Response('{invalid', {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    ],
  ])('maps %s to BadGatewayException', async (_caseName, response) => {
    fetcher.mockResolvedValueOnce(response);

    await expect(provider.reverseGeocode(input)).rejects.toBeInstanceOf(
      BadGatewayException,
    );
  });

  it.each([
    ['HTTP 404', jsonResponse({}, 404)],
    ['Nominatim error response', jsonResponse({ error: 'Unable to geocode' })],
  ])('maps %s to NotFoundException', async (_caseName, response) => {
    fetcher.mockResolvedValueOnce(response);

    await expect(provider.reverseGeocode(input)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('does not cache failures', async () => {
    fetcher
      .mockResolvedValueOnce(jsonResponse({}, 503))
      .mockResolvedValueOnce(jsonResponse(validPayload));

    await expect(provider.reverseGeocode(input)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    await expect(provider.reverseGeocode(input)).resolves.toMatchObject({
      source: 'nominatim',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
