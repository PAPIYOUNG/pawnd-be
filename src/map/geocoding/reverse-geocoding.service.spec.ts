import { ReverseGeocodeQueryDto } from '../dto/reverse-geocode-query.dto';
import { GeocodingProvider, ReverseGeocodeResult } from './geocoding-provider';
import { ReverseGeocodingService } from './reverse-geocoding.service';

describe('ReverseGeocodingService', () => {
  const reverseGeocode = jest.fn();
  const provider: GeocodingProvider = { reverseGeocode };
  const service = new ReverseGeocodingService(provider);

  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('delegates reverse geocoding to the injected provider', async () => {
    const query: ReverseGeocodeQueryDto = {
      latitude: 13.7563,
      longitude: 100.5018,
      language: 'th',
    };
    const result: ReverseGeocodeResult = {
      displayName: 'Bangkok, Thailand',
      address: {
        road: null,
        neighbourhood: null,
        subdistrict: null,
        district: 'Bangkok',
        province: 'Bangkok',
        postcode: null,
        country: 'Thailand',
        countryCode: 'th',
      },
      source: 'nominatim',
      attribution: 'Data © OpenStreetMap contributors',
    };
    reverseGeocode.mockResolvedValue(result);

    await expect(service.reverseGeocode(query)).resolves.toBe(result);
    expect(reverseGeocode).toHaveBeenCalledWith(query);
  });
});
