import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, createHash } from 'node:crypto';
import type { Env } from '../../config/env.validation';

export type AccessTokenPayload = {
  sub: string;
  roles: string[];
  permissions: string[];
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService<Env, true>,
  ) {}

  signAccessToken(payload: AccessTokenPayload): Promise<string> {
    return this.jwtService.signAsync(payload, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.configService.get('JWT_ACCESS_EXPIRES_IN', {
        infer: true,
      }),
    });
  }

  async verifyAccessToken(token: string): Promise<AccessTokenPayload> {
    return this.jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: this.configService.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  /** Opaque random refresh token -- never a JWT, never decodable, only comparable by its hash. */
  generateRefreshToken(): string {
    return randomBytes(48).toString('base64url');
  }

  hashRefreshToken(token: string): string {
    const secret = this.configService.get('JWT_REFRESH_SECRET', {
      infer: true,
    });
    return createHash('sha256').update(`${secret}:${token}`).digest('hex');
  }
}
