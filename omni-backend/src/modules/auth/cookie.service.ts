import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { randomBytes } from 'node:crypto';
import { parseDurationMs } from '../../common/utils/duration';
import { CSRF_COOKIE_NAME } from '../../common/guards/csrf.guard';
import type { Env } from '../../config/env.validation';

const ACCESS_COOKIE_NAME = 'omni_access';
const REFRESH_COOKIE_NAME = 'omni_refresh';

@Injectable()
export class CookieService {
  constructor(private readonly configService: ConfigService<Env, true>) {}

  setAuthCookies(
    res: Response,
    accessToken: string,
    refreshToken: string,
  ): void {
    const base = this.baseCookieOptions();
    res.cookie(ACCESS_COOKIE_NAME, accessToken, {
      ...base,
      httpOnly: true,
      maxAge: parseDurationMs(
        this.configService.get('JWT_ACCESS_EXPIRES_IN', { infer: true }),
      ),
    });
    res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
      ...base,
      httpOnly: true,
      path: '/api/v1/auth',
      maxAge: parseDurationMs(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
      ),
    });
    // Deliberately NOT HttpOnly -- the frontend JS must be able to read
    // this and echo it back as X-CSRF-Token. See ADR-004.
    res.cookie(CSRF_COOKIE_NAME, randomBytes(32).toString('hex'), {
      ...base,
      httpOnly: false,
      maxAge: parseDurationMs(
        this.configService.get('JWT_REFRESH_EXPIRES_IN', { infer: true }),
      ),
    });
  }

  clearAuthCookies(res: Response): void {
    const base = this.baseCookieOptions();
    res.clearCookie(ACCESS_COOKIE_NAME, base);
    res.clearCookie(REFRESH_COOKIE_NAME, { ...base, path: '/api/v1/auth' });
    res.clearCookie(CSRF_COOKIE_NAME, base);
  }

  readRefreshToken(req: {
    cookies?: Record<string, string>;
  }): string | undefined {
    return req.cookies?.[REFRESH_COOKIE_NAME];
  }

  private baseCookieOptions() {
    const domain = this.configService.get('COOKIE_DOMAIN', { infer: true });
    return {
      secure: this.configService.get('COOKIE_SECURE', { infer: true }),
      sameSite: this.configService.get('COOKIE_SAME_SITE', { infer: true }),
      path: '/',
      ...(domain ? { domain } : {}),
    };
  }
}
