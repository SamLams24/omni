import { Test } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService } from './session.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    user: { findUnique: jest.fn(), create: jest.fn() },
    role: { findUnique: jest.fn() },
    rolePermission: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const passwordService = { hash: jest.fn(), verify: jest.fn() };
  const tokenService = {
    signAccessToken: jest.fn().mockResolvedValue('signed.access.token'),
  };
  const sessionService = {
    createSession: jest
      .fn()
      .mockResolvedValue({ refreshToken: 'new-refresh-token' }),
    rotateSession: jest.fn(),
    revokeSession: jest.fn(),
    revokeAllForUser: jest.fn(),
  };

  return {
    prisma,
    passwordService,
    tokenService,
    sessionService,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          AuthService,
          { provide: PrismaService, useValue: prisma },
          { provide: PasswordService, useValue: passwordService },
          { provide: TokenService, useValue: tokenService },
          { provide: SessionService, useValue: sessionService },
        ],
      }).compile();
      return moduleRef.get(AuthService);
    },
  };
}

const meta = { userAgent: 'jest', ipAddress: '127.0.0.1' };

describe('AuthService.register', () => {
  it('succeeds and issues tokens for a new user', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique
      .mockResolvedValueOnce(null) // duplicate check
      .mockResolvedValueOnce({
        id: 'u1',
        name: 'Ama',
        email: 'ama@example.test',
        avatarUrl: null,
        roles: [{ role: { name: 'BUYER' } }],
      }); // requireSafeUser after creation
    t.prisma.role.findUnique.mockResolvedValue({
      id: 'role-buyer',
      name: 'BUYER',
    });
    t.prisma.user.create.mockResolvedValue({ id: 'u1' });
    t.passwordService.hash.mockResolvedValue('hashed-password');

    const service = await t.build();
    const result = await service.register(
      { name: 'Ama', email: 'ama@example.test', password: 'supersecret' },
      meta,
    );

    expect(result.user.email).toBe('ama@example.test');
    expect(result.accessToken).toBe('signed.access.token');
    expect(result.refreshToken).toBe('new-refresh-token');
    expect(t.passwordService.hash).toHaveBeenCalledWith('supersecret');
  });

  it('rejects a duplicate email', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue({ id: 'existing' });

    const service = await t.build();
    const attempt = service.register(
      { name: 'Ama', email: 'ama@example.test', password: 'supersecret' },
      meta,
    );
    await expect(attempt).rejects.toThrow(AppException);
    await expect(attempt).rejects.toThrow(/existe déjà/);
    expect(t.prisma.user.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.login', () => {
  it('succeeds with correct credentials', async () => {
    const t = buildTestModule();
    const dbUser = {
      id: 'u1',
      email: 'ama@example.test',
      passwordHash: 'hashed-password',
      isActive: true,
      name: 'Ama',
      avatarUrl: null,
      roles: [{ role: { name: 'BUYER' } }],
    };
    t.prisma.user.findUnique.mockResolvedValue(dbUser);
    t.passwordService.verify.mockResolvedValue(true);

    const service = await t.build();
    const result = await service.login(
      { email: 'ama@example.test', password: 'supersecret' },
      meta,
    );

    expect(result.user.id).toBe('u1');
    expect(result.accessToken).toBe('signed.access.token');
  });

  it('rejects an unknown email with a generic error (no account-existence leak)', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(
      service.login(
        { email: 'nobody@example.test', password: 'whatever' },
        meta,
      ),
    ).rejects.toThrow(/incorrect/);
  });

  it('rejects a wrong password', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ama@example.test',
      passwordHash: 'hashed-password',
      isActive: true,
    });
    t.passwordService.verify.mockResolvedValue(false);

    const service = await t.build();
    await expect(
      service.login({ email: 'ama@example.test', password: 'wrong' }, meta),
    ).rejects.toThrow(/incorrect/);
  });

  it('rejects an OIDC-only account (no local password) attempting local login', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ama@example.test',
      passwordHash: null,
      isActive: true,
    });

    const service = await t.build();
    await expect(
      service.login({ email: 'ama@example.test', password: 'whatever' }, meta),
    ).rejects.toThrow(/incorrect/);
    expect(t.passwordService.verify).not.toHaveBeenCalled();
  });

  it('rejects a disabled user even with the correct password', async () => {
    const t = buildTestModule();
    t.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ama@example.test',
      passwordHash: 'hashed-password',
      isActive: false,
    });
    t.passwordService.verify.mockResolvedValue(true);

    const service = await t.build();
    await expect(
      service.login(
        { email: 'ama@example.test', password: 'supersecret' },
        meta,
      ),
    ).rejects.toThrow(/désactivé/);
  });
});

describe('AuthService.refresh / logout / logoutAll', () => {
  it('rotates the session and issues a fresh access token', async () => {
    const t = buildTestModule();
    t.sessionService.rotateSession.mockResolvedValue({
      userId: 'u1',
      refreshToken: 'rotated-token',
    });
    t.prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'ama@example.test',
      name: 'Ama',
      avatarUrl: null,
      roles: [{ role: { name: 'BUYER' } }],
    });

    const service = await t.build();
    const result = await service.refresh('old-refresh-token', meta);

    expect(t.sessionService.rotateSession).toHaveBeenCalledWith(
      'old-refresh-token',
      meta,
    );
    expect(result.refreshToken).toBe('rotated-token');
    expect(result.accessToken).toBe('signed.access.token');
  });

  it('propagates rejection when the session service rejects a stale/reused refresh token', async () => {
    const t = buildTestModule();
    t.sessionService.rotateSession.mockRejectedValue(
      new AppException(401, 'AUTH_REFRESH_TOKEN_INVALID', 'invalid'),
    );

    const service = await t.build();
    await expect(service.refresh('stale-token', meta)).rejects.toThrow(
      AppException,
    );
  });

  it('logout revokes only the presented session', async () => {
    const t = buildTestModule();
    const service = await t.build();
    await service.logout('some-refresh-token');
    expect(t.sessionService.revokeSession).toHaveBeenCalledWith(
      'some-refresh-token',
    );
  });

  it('logoutAll revokes every session for the user', async () => {
    const t = buildTestModule();
    const service = await t.build();
    await service.logoutAll('u1');
    expect(t.sessionService.revokeAllForUser).toHaveBeenCalledWith('u1');
  });
});
