import { Module } from '@nestjs/common';
import { BusinessModule } from '../business/business.module';
import { MapController } from './map.controller';
import { MapService } from './map.service';
import { OverpassService } from './overpass.service';

@Module({
  imports: [BusinessModule],
  controllers: [MapController],
  providers: [MapService, OverpassService],
})
export class MapModule {}
