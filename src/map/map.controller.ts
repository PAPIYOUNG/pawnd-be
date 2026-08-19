import { Controller, Get, Query } from '@nestjs/common';

import { Public } from '@/common/decorators/public.decorator';
import { MapPostQueryDto } from './dto/map-post-query.dto';
import { MapPostFeatureCollection, MapService } from './map.service';

@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Public()
  @Get('posts')
  getMapPosts(
    @Query() query: MapPostQueryDto,
  ): Promise<MapPostFeatureCollection> {
    return this.mapService.getMapPosts(query);
  }
}
