import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../../common/decorators/public.decorator';
import { BboxQueryDto } from '../business/dto/bbox-query.dto';
import { MapService } from './map.service';

@ApiTags('map')
@Controller('map')
export class MapController {
  constructor(private readonly mapService: MapService) {}

  @Public()
  @Get('facilities')
  @ApiOperation({
    summary:
      'List map facilities (OSM + OMNI businesses) within a bounding box',
  })
  getFacilities(@Query() bbox: BboxQueryDto) {
    return this.mapService.getFacilities(bbox);
  }
}
