import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { SessionService } from './session.service';
import { TokenService } from './token.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    session: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
  };
  const tokenService = {
    generateRefreshToken: jest.fn().mockReturnValue('plain-refresh-token'),
    hashRefreshToken: jest.fn((token: string) => `hash(${token})`),
  };
  const configService = { get: jest.fn().mockReturnValue('30d') };

  return {
    prisma,
    tokenService,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          SessionService,
          { provide: PrismaService, useValue: prisma },
          { provide: TokenService, useValue: tokenService },
          { provide: ConfigService, useValue: configService },
        ],
      }).compile();
      return moduleRef.get(SessionService);
    },
  };
}

const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };

describe('SessionService.createSession', () => {
  it('stores only the hash, never the plain refresh token', async () => {
    const t = buildTestModule();
    t.prisma.session.create.mockResolvedValue({ id: 's1' });

    const service = await t.build();
    const result = await service.createSession('u1', meta);

    expect(result.refreshToken).toBe('plain-refresh-token');
    expect(t.prisma.session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          refreshTokenHash: 'hash(plain-refresh-token)',
          userId: 'u1',
        }),
      }),
    );
  });
});

describe('SessionService.rotateSession', () => {
  it('succeeds for a valid, non-expired, non-revoked session and revokes the old one', async () => {
    const t = buildTestModule();
    t.prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() + 1_000_000),
    });
    t.prisma.session.create.mockResolvedValue({ id: 's2' });

    const service = await t.build();
    const result = await service.rotateSession('old-token', meta);

    expect(result.userId).toBe('u1');
    expect(t.prisma.session.update).toHaveBeenCalledWith({
      where: { id: 's1' },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rejects reuse of an already-rotated (revoked) refresh token', async () => {
    const t = buildTestModule();
    t.prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      revokedAt: new Date(), // already rotated once
      expiresAt: new Date(Date.now() + 1_000_000),
    });

    const service = await t.build();
    await expect(service.rotateSession('stale-token', meta)).rejects.toThrow(
      AppException,
    );
  });

  it('rejects an expired session', async () => {
    const t = buildTestModule();
    t.prisma.session.findUnique.mockResolvedValue({
      id: 's1',
      userId: 'u1',
      revokedAt: null,
      expiresAt: new Date(Date.now() - 1_000), // already expired
    });

    const service = await t.build();
    await expect(service.rotateSession('expired-token', meta)).rejects.toThrow(
      AppException,
    );
  });

  it('rejects an unknown refresh token', async () => {
    const t = buildTestModule();
    t.prisma.session.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(service.rotateSession('unknown-token', meta)).rejects.toThrow(
      AppException,
    );
  });
});

describe('SessionService.revokeSession / revokeAllForUser', () => {
  it('revokes only the matching, still-active session', async () => {
    const t = buildTestModule();
    const service = await t.build();
    await service.revokeSession('some-token');

    expect(t.prisma.session.updateMany).toHaveBeenCalledWith({
      where: { refreshTokenHash: 'hash(some-token)', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('revokes every active session for a user (logout-all)', async () => {
    const t = buildTestModule();
    const service = await t.build();
    await service.revokeAllForUser('u1');

    expect(t.prisma.session.updateMany).toHaveBeenCalledWith({
      where: { userId: 'u1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
