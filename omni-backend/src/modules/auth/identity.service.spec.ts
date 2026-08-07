import { Test } from '@nestjs/testing';
import { IdentityService } from './identity.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException } from '../../common/errors/error-codes';

function buildTestModule() {
  const prisma = {
    identity: { findUnique: jest.fn(), create: jest.fn() },
    user: { findUnique: jest.fn(), create: jest.fn() },
  };

  return {
    prisma,
    async build() {
      const moduleRef = await Test.createTestingModule({
        providers: [
          IdentityService,
          { provide: PrismaService, useValue: prisma },
        ],
      }).compile();
      return moduleRef.get(IdentityService);
    },
  };
}

describe('IdentityService.linkOrCreateFromOidc', () => {
  it('reconnects an existing identity directly, without touching the users table', async () => {
    const t = buildTestModule();
    const fakeUser = { id: 'u1', email: 'ama@example.test' };
    t.prisma.identity.findUnique.mockResolvedValue({
      id: 'id1',
      user: fakeUser,
    });

    const service = await t.build();
    const user = await service.linkOrCreateFromOidc({
      sub: 'google-oauth2|123',
      email: 'ama@example.test',
      emailVerified: true,
      name: 'Ama',
      connection: 'google-oauth2',
    });

    expect(user).toBe(fakeUser);
    expect(t.prisma.user.findUnique).not.toHaveBeenCalled();
    expect(t.prisma.user.create).not.toHaveBeenCalled();
  });

  it('creates a brand-new user + identity when no user exists with that email', async () => {
    const t = buildTestModule();
    t.prisma.identity.findUnique.mockResolvedValue(null);
    t.prisma.user.findUnique.mockResolvedValue(null);
    const createdUser = { id: 'u2', email: 'new@example.test' };
    t.prisma.user.create.mockResolvedValue(createdUser);

    const service = await t.build();
    const user = await service.linkOrCreateFromOidc({
      sub: 'google-oauth2|456',
      email: 'new@example.test',
      emailVerified: true,
      name: 'New User',
      connection: 'google-oauth2',
    });

    expect(user).toBe(createdUser);
    expect(t.prisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'new@example.test',
          identities: expect.objectContaining({
            create: expect.objectContaining({
              provider: 'AUTH0',
              providerUserId: 'google-oauth2|456',
            }),
          }),
        }),
      }),
    );
  });

  it('links a new identity to an existing user when the external provider verified the email', async () => {
    const t = buildTestModule();
    t.prisma.identity.findUnique.mockResolvedValue(null);
    const existingUser = { id: 'u3', email: 'samuel@example.test' };
    t.prisma.user.findUnique.mockResolvedValue(existingUser);

    const service = await t.build();
    const user = await service.linkOrCreateFromOidc({
      sub: 'facebook|789',
      email: 'samuel@example.test',
      emailVerified: true,
      name: 'Samuel',
      connection: 'facebook',
    });

    expect(user).toBe(existingUser);
    expect(t.prisma.identity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'u3',
          provider: 'AUTH0',
          providerUserId: 'facebook|789',
        }),
      }),
    );
  });

  it('refuses to link when the external provider did NOT verify the email (unsafe linking)', async () => {
    const t = buildTestModule();
    t.prisma.identity.findUnique.mockResolvedValue(null);
    t.prisma.user.findUnique.mockResolvedValue({
      id: 'u4',
      email: 'victim@example.test',
    });

    const service = await t.build();
    await expect(
      service.linkOrCreateFromOidc({
        sub: 'facebook|attacker',
        email: 'victim@example.test',
        emailVerified: false,
        name: 'Attacker',
        connection: 'facebook',
      }),
    ).rejects.toThrow(AppException);
    expect(t.prisma.identity.create).not.toHaveBeenCalled();
    expect(t.prisma.user.create).not.toHaveBeenCalled();
  });

  it('refuses to create an account when the OIDC profile has no email at all', async () => {
    const t = buildTestModule();
    t.prisma.identity.findUnique.mockResolvedValue(null);

    const service = await t.build();
    await expect(
      service.linkOrCreateFromOidc({
        sub: 'google-oauth2|noemail',
        email: null,
        emailVerified: false,
        name: 'No Email',
        connection: 'google-oauth2',
      }),
    ).rejects.toThrow(AppException);
  });
});
