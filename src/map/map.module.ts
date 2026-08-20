import { Module } from '@nestjs/common';

import {
  GEOCODING_CLOCK,
  GEOCODING_PROVIDER,
  GEOCODING_SLEEPER,
  NOMINATIM_FETCH,
} from './geocoding/geocoding-provider';
import { NominatimGeocodingProvider } from './geocoding/nominatim-geocoding.provider';
import { ReverseGeocodingService } from './geocoding/reverse-geocoding.service';
import { MapController } from './map.controller';
import { MapService } from './map.service';

@Module({
  controllers: [MapController],
  providers: [
    MapService,
    ReverseGeocodingService,
    NominatimGeocodingProvider,
    {
      provide: GEOCODING_PROVIDER,
      useExisting: NominatimGeocodingProvider,
    },
    {
      provide: NOMINATIM_FETCH,
      useValue: globalThis.fetch.bind(globalThis),
    },
    {
      provide: GEOCODING_CLOCK,
      useValue: { now: () => Date.now() },
    },
    {
      provide: GEOCODING_SLEEPER,
      useValue: {
        sleep: (milliseconds: number) =>
          new Promise<void>((resolve) => setTimeout(resolve, milliseconds)),
      },
    },
  ],
})
export class MapModule {}
