import { HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Session } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { AppException, ErrorCode } from '../../common/errors/error-codes';
import { parseDurationMs } from '../../common/utils/duration';
import { TokenService } from './token.service';
import type { Env } from '../../config/env.validation';

export type SessionMeta = {
  userAgent?: string | undefined;
  ipAddress?: string | undefined;
};

@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenService: TokenService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  /** Issues a brand-new refresh token + Session row (login/register). */
  async createSession(
    userId: string,
    meta: SessionMeta,
  ): Promise<{ session: Session; refreshToken: string }> {
    const refreshToken = this.tokenService.generateRefreshToken();
    const ttlMs = parseDurationMs(
      this.configService.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
    );

    const session = await this.prisma.session.create({
      data: {
        userId,
        refreshTokenHash: this.tokenService.hashRefreshToken(refreshToken),
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });

    return { session, refreshToken };
  }

  /**
   * Refresh token rotation: the presented token is looked up, validated,
   * revoked, and replaced by a new one in the same operation. Presenting
   * an already-rotated (stale) token is treated as possible token theft
   * and rejected -- see docs/api/authentication.md.
   */
  async rotateSession(
    presentedToken: string,
    meta: SessionMeta,
  ): Promise<{ session: Session; refreshToken: string; userId: string }> {
    const presentedHash = this.tokenService.hashRefreshToken(presentedToken);
    const existing = await this.prisma.session.findUnique({
      where: { refreshTokenHash: presentedHash },
    });

    if (
      !existing ||
      existing.revokedAt ||
      existing.expiresAt.getTime() < Date.now()
    ) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_REFRESH_TOKEN_INVALID,
        'Ce jeton de rafraîchissement est invalide ou a expiré.',
      );
    }

    await this.prisma.session.update({
      where: { id: existing.id },
      data: { revokedAt: new Date() },
    });

    const { session, refreshToken } = await this.createSession(
      existing.userId,
      meta,
    );
    return { session, refreshToken, userId: existing.userId };
  }

  async revokeSession(presentedToken: string): Promise<void> {
    const presentedHash = this.tokenService.hashRefreshToken(presentedToken);
    await this.prisma.session.updateMany({
      where: { refreshTokenHash: presentedHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
