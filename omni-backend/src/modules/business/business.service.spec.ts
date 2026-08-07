import { Test } from '@nestjs/testing';
import { BusinessService } from './business.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    business: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    businessOwner: { findUnique: jest.fn() },
  };

  return {
    prisma,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          BusinessService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      return moduleRef.get(BusinessService);
    },
  };
}

const BASE_BUSINESS = {
  id: 'b1',
  name: 'Chez Ama',
  categoryId: null,
  description: null,
  phone: '+22890000000',
  email: null,
  address: null,
  neighborhood: null,
  latitude: 6.1375,
  longitude: 1.2154,
  isOnline: true,
  isAvailable: true,
  rating: null,
  kycStatus: 'NONE',
  source: 'OMNI',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  subscriptions: [],
};

describe('BusinessService', () => {
  it('findInBbox scopes the query to OMNI-sourced businesses within the box', async () => {
    const t = buildTestModule();
    t.prisma.business.findMany.mockResolvedValue([BASE_BUSINESS]);

    const service = await t.build();
    const result = await service.findInBbox({
      south: 6.1,
      west: 1.1,
      north: 6.2,
      east: 1.3,
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe('b1');
    expect(t.prisma.business.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ source: 'OMNI' }),
      }),
    );
  });

  it('findById throws BUSINESS_NOT_FOUND for a missing business', async () => {
    const t = buildTestModule();
    t.prisma.business.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.findById('missing')).rejects.toThrow(AppException);
  });

  it('findById returns the mapped business when found', async () => {
    const t = buildTestModule();
    t.prisma.business.findUnique.mockResolvedValue(BASE_BUSINESS);

    const service = await t.build();
    const result = await service.findById('b1');
    expect(result.id).toBe('b1');
    expect(result.status).toBe('UNCONFIRMED');
  });

  it('create attaches the creating user as an owner', async () => {
    const t = buildTestModule();
    t.prisma.business.create.mockResolvedValue(BASE_BUSINESS);

    const service = await t.build();
    await service.create('u1', { name: 'Chez Ama', phone: '+22890000000' });

    expect(t.prisma.business.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          owners: { create: { userId: 'u1', role: 'owner' } },
        }),
      }),
    );
  });

  it('update rejects a non-owner with AUTH_FORBIDDEN', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(
      service.update('b1', 'not-the-owner', { name: 'New name' }),
    ).rejects.toThrow(AppException);
    expect(t.prisma.business.update).not.toHaveBeenCalled();
  });

  it('update succeeds for the recorded owner', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.business.update.mockResolvedValue({
      ...BASE_BUSINESS,
      name: 'New name',
    });

    const service = await t.build();
    const result = await service.update('b1', 'u1', { name: 'New name' });
    expect(result.name).toBe('New name');
  });
});
