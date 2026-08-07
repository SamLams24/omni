import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { IS_PUBLIC_KEY } from '../../../common/decorators/public.decorator';
import { AppException, ErrorCode } from '../../../common/errors/error-codes';
import { TokenService, type AccessTokenPayload } from '../token.service';

const ACCESS_COOKIE_NAME = 'omni_access';

function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const match = /^Bearer\s+(.+)$/i.exec(authHeader.trim());
  if (!match) return null;
  const token = match[1]?.trim();
  return token && token.length > 0 ? token : null;
}

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    // Cookie takes priority over the Authorization header, same
    // cookie-first/Bearer-fallback contract as the rest of OMNI (see
    // apps/web/src/lib/auth.ts and docs/api/authentication.md).
    const token: string | null =
      (request.cookies?.[ACCESS_COOKIE_NAME] as string | undefined) ??
      extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_SESSION_EXPIRED,
        'Authentification requise.',
      );
    }

    try {
      request.user = await this.tokenService.verifyAccessToken(token);
      return true;
    } catch {
      throw new AppException(
        HttpStatus.UNAUTHORIZED,
        ErrorCode.AUTH_SESSION_EXPIRED,
        'Session expirée ou invalide.',
      );
    }
  }
}
