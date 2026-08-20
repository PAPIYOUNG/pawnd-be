import { Inject, Injectable } from '@nestjs/common';

import { ReverseGeocodeQueryDto } from '../dto/reverse-geocode-query.dto';
import { GEOCODING_PROVIDER } from './geocoding-provider';
import type {
  GeocodingProvider,
  ReverseGeocodeResult,
} from './geocoding-provider';

@Injectable()
export class ReverseGeocodingService {
  constructor(
    @Inject(GEOCODING_PROVIDER)
    private readonly geocodingProvider: GeocodingProvider,
  ) {}

  reverseGeocode(query: ReverseGeocodeQueryDto): Promise<ReverseGeocodeResult> {
    return this.geocodingProvider.reverseGeocode(query);
  }
}
