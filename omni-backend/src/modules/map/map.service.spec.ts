import { Test } from '@nestjs/testing';
import { MapService } from './map.service';
import { OverpassService, OsmOverpassError } from './overpass.service';
import { BusinessService } from '../business/business.service';

const BBOX = { south: 6.1, west: 1.1, north: 6.2, east: 1.3 };

function buildTestModule() {
  const overpassService = { queryElements: jest.fn() };
  const businessService = { findInBbox: jest.fn() };

  return {
    overpassService,
    businessService,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          MapService,
          { provide: OverpassService, useValue: overpassService },
          { provide: BusinessService, useValue: businessService },
        ],
      }).compile();
      return moduleRef.get(MapService);
    },
  };
}

describe('MapService.getFacilities', () => {
  it('merges normalized OSM elements with OMNI businesses', async () => {
    const t = buildTestModule();
    t.overpassService.queryElements.mockResolvedValue([
      {
        type: 'node',
        id: 1,
        lat: 6.15,
        lon: 1.2,
        tags: { shop: 'bakery', name: 'Boulangerie' },
      },
    ]);
    t.businessService.findInBbox.mockResolvedValue([
      {
        id: 'b1',
        name: 'Chez Ama',
        address: 'Rue 12',
        phone: '+22890000000',
        latitude: 6.14,
        longitude: 1.22,
        status: 'CERTIFIED',
      },
    ]);

    const service = await t.build();
    const facilities = await service.getFacilities(BBOX);

    expect(facilities).toHaveLength(2);
    expect(facilities.find((f) => f.source === 'omni')).toEqual(
      expect.objectContaining({
        id: 'omni:b1',
        businessId: 'b1',
        status: 'CERTIFIED',
      }),
    );
    expect(facilities.find((f) => f.source === 'osm')).toEqual(
      expect.objectContaining({ id: 'osm:node:1', status: 'UNCONFIRMED' }),
    );
  });

  it('omits an OMNI business with no coordinates rather than fabricating a position', async () => {
    const t = buildTestModule();
    t.overpassService.queryElements.mockResolvedValue([]);
    t.businessService.findInBbox.mockResolvedValue([
      {
        id: 'b2',
        name: 'No location',
        address: null,
        phone: '+228',
        latitude: null,
        longitude: null,
        status: 'UNCONFIRMED',
      },
    ]);

    const service = await t.build();
    const facilities = await service.getFacilities(BBOX);
    expect(facilities).toHaveLength(0);
  });

  it('degrades gracefully to OMNI-only results when Overpass fails', async () => {
    const t = buildTestModule();
    t.overpassService.queryElements.mockRejectedValue(
      new OsmOverpassError('timeout'),
    );
    t.businessService.findInBbox.mockResolvedValue([
      {
        id: 'b1',
        name: 'Chez Ama',
        address: null,
        phone: '+228',
        latitude: 6.14,
        longitude: 1.22,
        status: 'CONFIRMED',
      },
    ]);

    const service = await t.build();
    const facilities = await service.getFacilities(BBOX);
    expect(facilities).toHaveLength(1);
    expect(facilities[0]?.source).toBe('omni');
  });
});
