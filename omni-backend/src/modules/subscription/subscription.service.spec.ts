import { Test } from '@nestjs/testing';
import { SubscriptionService } from './subscription.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    subscriptionPlan: { findMany: jest.fn() },
    subscription: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  return {
    prisma,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          SubscriptionService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      return moduleRef.get(SubscriptionService);
    },
  };
}

describe('SubscriptionService.cancel', () => {
  it('throws SUBSCRIPTION_NOT_FOUND for an unknown id', async () => {
    const t = buildTestModule();
    t.prisma.subscription.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.cancel('missing', 'u1')).rejects.toThrow(AppException);
  });

  it('rejects canceling a subscription that belongs to someone else', async () => {
    const t = buildTestModule();
    t.prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub1',
      userId: 'someone-else',
      status: 'ACTIVE',
    });

    const service = await t.build();
    await expect(service.cancel('sub1', 'u1')).rejects.toThrow(AppException);
    expect(t.prisma.subscription.update).not.toHaveBeenCalled();
  });

  it('rejects canceling an already-CANCELED or EXPIRED subscription', async () => {
    const t = buildTestModule();
    t.prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub1',
      userId: 'u1',
      status: 'EXPIRED',
    });

    const service = await t.build();
    await expect(service.cancel('sub1', 'u1')).rejects.toThrow(AppException);
  });

  it('cancels an ACTIVE subscription owned by the caller', async () => {
    const t = buildTestModule();
    t.prisma.subscription.findUnique.mockResolvedValue({
      id: 'sub1',
      userId: 'u1',
      status: 'ACTIVE',
    });
    t.prisma.subscription.update.mockResolvedValue({
      id: 'sub1',
      status: 'CANCELED',
    });

    const service = await t.build();
    const result = await service.cancel('sub1', 'u1');

    expect(result.status).toBe('CANCELED');
    expect(t.prisma.subscription.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'CANCELED' } }),
    );
  });
});
