import { Test } from '@nestjs/testing';
import { KycService } from './kyc.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    businessOwner: { findUnique: jest.fn() },
    business: { findUniqueOrThrow: jest.fn(), update: jest.fn() },
    kycRequest: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops: unknown[]) => Promise.all(ops)),
  };

  return {
    prisma,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [KycService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      return moduleRef.get(KycService);
    },
  };
}

describe('KycService.submit', () => {
  const dto = { businessId: 'b1', documents: ['doc1.pdf'] };

  it('rejects a non-owner', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.submit('u1', dto)).rejects.toThrow(AppException);
  });

  it('rejects submitting for an already-approved business', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.business.findUniqueOrThrow.mockResolvedValue({
      id: 'b1',
      kycStatus: 'APPROVED',
    });

    const service = await t.build();
    await expect(service.submit('u1', dto)).rejects.toThrow(AppException);
  });

  it('updates the existing pending request instead of creating a duplicate', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.business.findUniqueOrThrow.mockResolvedValue({
      id: 'b1',
      kycStatus: 'PENDING',
    });
    t.prisma.kycRequest.findFirst.mockResolvedValue({
      id: 'kyc1',
      status: 'PENDING',
    });
    t.prisma.kycRequest.update.mockResolvedValue({
      id: 'kyc1',
      documents: dto.documents,
    });

    const service = await t.build();
    await service.submit('u1', dto);

    expect(t.prisma.kycRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'kyc1' } }),
    );
    expect(t.prisma.kycRequest.create).not.toHaveBeenCalled();
  });

  it('creates a new request and marks the business PENDING when none exists yet', async () => {
    const t = buildTestModule();
    t.prisma.businessOwner.findUnique.mockResolvedValue({
      businessId: 'b1',
      userId: 'u1',
    });
    t.prisma.business.findUniqueOrThrow.mockResolvedValue({
      id: 'b1',
      kycStatus: 'NONE',
    });
    t.prisma.kycRequest.findFirst.mockResolvedValue(null);
    t.prisma.kycRequest.create.mockResolvedValue({ id: 'kyc2' });

    const service = await t.build();
    await service.submit('u1', dto);

    expect(t.prisma.kycRequest.create).toHaveBeenCalled();
    expect(t.prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { kycStatus: 'PENDING' } }),
    );
  });
});

describe('KycService.approve / reject', () => {
  it('approve throws KYC_REQUEST_NOT_FOUND for an unknown id', async () => {
    const t = buildTestModule();
    t.prisma.kycRequest.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.approve('missing', 'admin1')).rejects.toThrow(
      AppException,
    );
  });

  it('approve marks the request APPROVED and the business kycStatus APPROVED', async () => {
    const t = buildTestModule();
    t.prisma.kycRequest.findUnique.mockResolvedValue({
      id: 'kyc1',
      businessId: 'b1',
    });
    t.prisma.kycRequest.update.mockResolvedValue({
      id: 'kyc1',
      status: 'APPROVED',
    });

    const service = await t.build();
    const result = await service.approve('kyc1', 'admin1');

    expect(result.status).toBe('APPROVED');
    expect(t.prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'b1' },
        data: expect.objectContaining({ kycStatus: 'APPROVED' }),
      }),
    );
  });

  it('reject records the reason and marks the business kycStatus REJECTED', async () => {
    const t = buildTestModule();
    t.prisma.kycRequest.findUnique.mockResolvedValue({
      id: 'kyc1',
      businessId: 'b1',
    });
    t.prisma.kycRequest.update.mockResolvedValue({
      id: 'kyc1',
      status: 'REJECTED',
    });

    const service = await t.build();
    await service.reject('kyc1', 'admin1', 'Documents illisibles');

    expect(t.prisma.kycRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ rejectReason: 'Documents illisibles' }),
      }),
    );
    expect(t.prisma.business.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ kycStatus: 'REJECTED' }),
      }),
    );
  });
});
