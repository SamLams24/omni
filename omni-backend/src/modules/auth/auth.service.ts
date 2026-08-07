import { HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { SessionService, type SessionMeta } from './session.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  roles: string[];
};

export type AuthResult = {
  user: SafeUser;
  accessToken: string;
  refreshToken: string;
};

const DEFAULT_ROLE_ON_REGISTER = 'BUYER';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly sessionService: SessionService,
  ) {}

  async register(dto: RegisterDto, meta: SessionMeta): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new AppException(
        HttpStatus.CONFLICT,
        ErrorCode.USER_ALREADY_EXISTS,
        'Un compte existe déjà avec cette adresse e-mail.',
      );
    }

    const passwordHash = await this.passwordService.hash(dto.password);
    const role = await this.prisma.role.findUnique({
      where: { name: DEFAULT_ROLE_ON_REGISTER },
    });

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        passwordHash,
        ...(role ? { roles: { create: { roleId: role.id } } } : {}),
      },
    });

    return this.issueTokensFor(user.id, meta);
  }

  async login(dto: LoginDto, meta: SessionMeta): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Same error for "no such user" and "wrong password" -- never let a
    // client distinguish account existence via the auth endpoint.
    if (!user || !user.passwordHash) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'E-mail ou mot de passe incorrect.',
      );
    }

    const passwordValid = await this.passwordService.verify(
      user.passwordHash,
      dto.password,
    );
    if (!passwordValid) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_INVALID_CREDENTIALS,
        'E-mail ou mot de passe incorrect.',
      );
    }

    if (!user.isActive) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_USER_DISABLED,
        'Ce compte a été désactivé.',
      );
    }

    return this.issueTokensFor(user.id, meta);
  }

  async loginWithUserId(
    userId: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    return this.issueTokensFor(userId, meta);
  }

  async refresh(
    presentedRefreshToken: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const { userId, refreshToken } = await this.sessionService.rotateSession(
      presentedRefreshToken,
      meta,
    );
    const user = await this.requireSafeUser(userId);
    const accessToken = await this.signAccessTokenFor(userId, user.roles);
    return { user, accessToken, refreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    await this.sessionService.revokeSession(refreshToken);
  }

  async logoutAll(userId: string): Promise<void> {
    await this.sessionService.revokeAllForUser(userId);
  }

  async me(userId: string): Promise<SafeUser> {
    return this.requireSafeUser(userId);
  }

  private async issueTokensFor(
    userId: string,
    meta: SessionMeta,
  ): Promise<AuthResult> {
    const user = await this.requireSafeUser(userId);
    const accessToken = await this.signAccessTokenFor(userId, user.roles);
    const { refreshToken } = await this.sessionService.createSession(
      userId,
      meta,
    );
    return { user, accessToken, refreshToken };
  }

  private async signAccessTokenFor(
    userId: string,
    roles: string[],
  ): Promise<string> {
    const permissions = await this.loadPermissions(roles);
    return this.tokenService.signAccessToken({
      sub: userId,
      roles,
      permissions,
    });
  }

  private async loadPermissions(roleNames: string[]): Promise<string[]> {
    if (roleNames.length === 0) return [];
    const rolePermissions = await this.prisma.rolePermission.findMany({
      where: { role: { name: { in: roleNames } } },
      include: { permission: true },
    });
    return [...new Set(rolePermissions.map((rp) => rp.permission.key))];
  }

  private async requireSafeUser(userId: string): Promise<SafeUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: { include: { role: true } } },
    });
    if (!user) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.USER_NOT_FOUND,
        'Utilisateur introuvable.',
      );
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      roles: user.roles.map((ur) => ur.role.name),
    };
  }
}
