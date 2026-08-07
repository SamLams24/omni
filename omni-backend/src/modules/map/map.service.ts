import { Injectable } from '@nestjs/common';
import { BusinessService } from '../business/business.service';
import type { BboxQuery } from '../business/dto/business.dto';
import { OverpassService, type Bbox } from './overpass.service';
import { normalizeOsmElement } from './osm-normalize.util';
import type { MapFacilityDto } from './dto/map-facility.dto';

@Injectable()
export class MapService {
  constructor(
    private readonly overpassService: OverpassService,
    private readonly businessService: BusinessService,
  ) {}

  async getFacilities(bbox: BboxQuery): Promise<MapFacilityDto[]> {
    const [osmElements, omniBusinesses] = await Promise.all([
      this.queryOsm(bbox),
      this.businessService.findInBbox(bbox),
    ]);

    const osmFacilities = osmElements
      .map((element) => normalizeOsmElement(element))
      .filter((facility): facility is MapFacilityDto => facility !== null);

    const omniFacilities: MapFacilityDto[] = omniBusinesses
      .filter(
        (business) => business.latitude !== null && business.longitude !== null,
      )
      .map((business) => ({
        id: `omni:${business.id}`,
        source: 'omni',
        businessId: business.id,
        name: business.name,
        category: null,
        subcategory: null,
        latitude: business.latitude as number,
        longitude: business.longitude as number,
        address: business.address,
        phone: business.phone,
        website: null,
        openingHours: null,
        status: business.status,
        tags: {},
      }));

    return [...omniFacilities, ...osmFacilities];
  }

  /**
   * OSM is a best-effort enrichment layer, not a hard dependency: if
   * Overpass is down or times out, buyers still see every real OMNI
   * business in the box. Failures are swallowed here (not surfaced as
   * OSM_SERVICE_UNAVAILABLE to the whole endpoint) precisely so a flaky
   * public Overpass instance never breaks the map for OMNI's own data.
   */
  private async queryOsm(bbox: Bbox) {
    try {
      return await this.overpassService.queryElements(bbox);
    } catch {
      return [];
    }
  }
}
