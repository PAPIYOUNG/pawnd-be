import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '@/common/decorators/public.decorator';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { NearbyPostQueryDto } from './dto/nearby-post-query.dto';
import { ReverseGeocodeQueryDto } from './dto/reverse-geocode-query.dto';
import { ReverseGeocodeResult } from './geocoding/geocoding-provider';
import { ReverseGeocodingService } from './geocoding/reverse-geocoding.service';
import {
  MapPostFeatureCollection,
  MapService,
  NearbyMapPostFeatureCollection,
} from './map.service';

@Controller('map')
export class MapController {
  constructor(
    private readonly mapService: MapService,
    private readonly reverseGeocodingService: ReverseGeocodingService,
  ) {}

  @Get('reverse-geocode')
  reverseGeocode(
    @Query() query: ReverseGeocodeQueryDto,
  ): Promise<ReverseGeocodeResult> {
    return this.reverseGeocodingService.reverseGeocode(query);
  }

  @Public()
  @Get('posts/nearby')
  getNearbyPosts(
    @Query() query: NearbyPostQueryDto,
  ): Promise<NearbyMapPostFeatureCollection> {
    return this.mapService.getNearbyPosts(query);
  }

  @Public()
  @Get('posts')
  getMapPosts(
    @Query() query: MapPostQueryDto,
  ): Promise<MapPostFeatureCollection> {
    return this.mapService.getMapPosts(query);
  }
}
