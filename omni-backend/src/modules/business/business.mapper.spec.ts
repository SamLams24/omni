import { Prisma } from '@prisma/client';
import {
  toBusinessDto,
  type BusinessWithSubscriptions,
} from './business.mapper';

function buildBusiness(
  overrides: Partial<BusinessWithSubscriptions> = {},
): BusinessWithSubscriptions {
  return {
    id: 'b1',
    name: 'Chez Ama',
    categoryId: null,
    description: null,
    phone: '+22890000000',
    email: null,
    address: null,
    neighborhood: null,
    latitude: null,
    longitude: null,
    isOnline: true,
    isAvailable: true,
    rating: null,
    kycStatus: 'NONE',
    kycReviewedAt: null,
    source: 'OMNI',
    osmType: null,
    osmId: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    subscriptions: [],
    ...overrides,
  } as unknown as BusinessWithSubscriptions;
}

describe('toBusinessDto', () => {
  it('converts latitude/longitude/rating to plain numbers', () => {
    const business = buildBusiness({
      latitude: new Prisma.Decimal(6.1375),
      longitude: new Prisma.Decimal(1.2154),
      rating: new Prisma.Decimal(4.5),
    });
    const dto = toBusinessDto(business);
    expect(dto.latitude).toBe(6.1375);
    expect(dto.longitude).toBe(1.2154);
    expect(dto.rating).toBe(4.5);
  });

  it('leaves latitude/longitude/rating null when unset', () => {
    const dto = toBusinessDto(buildBusiness());
    expect(dto.latitude).toBeNull();
    expect(dto.longitude).toBeNull();
    expect(dto.rating).toBeNull();
  });

  it('computes CERTIFIED status when an active premium subscription exists', () => {
    const business = buildBusiness({
      kycStatus: 'APPROVED',
      subscriptions: [
        { tier: 'PREMIUM', status: 'ACTIVE', endDate: null },
      ] as never,
    });
    expect(toBusinessDto(business).status).toBe('CERTIFIED');
  });

  it('computes UNCONFIRMED status for an OSM-sourced facility', () => {
    const business = buildBusiness({ source: 'OSM', kycStatus: 'APPROVED' });
    expect(toBusinessDto(business).status).toBe('UNCONFIRMED');
  });

  it('ignores an expired premium subscription and falls back to CONFIRMED', () => {
    const business = buildBusiness({
      kycStatus: 'APPROVED',
      subscriptions: [
        {
          tier: 'PREMIUM',
          status: 'ACTIVE',
          endDate: new Date('2020-01-01T00:00:00.000Z'),
        },
      ] as never,
    });
    expect(toBusinessDto(business).status).toBe('CONFIRMED');
  });
});
