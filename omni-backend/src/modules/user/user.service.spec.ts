import { Test } from '@nestjs/testing';
import { UserService } from './user.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    user: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  return {
    prisma,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [UserService, { provide: PrismaService, useValue: prisma }],
      }).compile();
      return moduleRef.get(UserService);
    },
  };
}

const BASE_USER = {
  id: 'u1',
  name: 'Ama',
  email: 'ama@example.test',
  isActive: true,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  roles: [{ role: { name: 'BUYER' } }],
};

describe('UserService', () => {
  it('listAll flattens each user role join into a plain string array', async () => {
    const t = buildTestModule();
    t.prisma.user.findMany.mockResolvedValue([BASE_USER]);

    const service = await t.build();
    const result = await service.listAll();

    expect(result[0]?.roles).toEqual(['BUYER']);
  });

  it('setActive throws USER_NOT_FOUND for an unknown id', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.setActive('missing', false)).rejects.toThrow(
      AppException,
    );
  });

  it('setActive(false) suspends a user', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue(BASE_USER);
    t.prisma.user.update.mockResolvedValue({ ...BASE_USER, isActive: false });

    const service = await t.build();
    const result = await service.setActive('u1', false);

    expect(result.isActive).toBe(false);
    expect(t.prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { isActive: false } }),
    );
  });
});
