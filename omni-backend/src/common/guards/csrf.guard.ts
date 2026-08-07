import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { timingSafeEqual } from 'node:crypto';
import { SKIP_CSRF_KEY } from '../decorators/skip-csrf.decorator';
import { AppException, ErrorCode } from '../errors/error-codes';

export const CSRF_COOKIE_NAME = 'omni_csrf';
export const CSRF_HEADER_NAME = 'x-csrf-token';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit cookie CSRF protection -- see
 * docs/architecture/ADR-004-csrf-protection.md. Applies to every mutating
 * request unless the route is explicitly marked @SkipCsrf() (e.g. webhooks
 * authenticated by HMAC signature instead of cookies).
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(request.method)) return true;

    const skip = this.reflector.getAllAndOverride<boolean>(SKIP_CSRF_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (skip) return true;

    const cookieToken = request.cookies?.[CSRF_COOKIE_NAME] as
      string | undefined;
    const headerToken = request.headers[CSRF_HEADER_NAME] as string | undefined;

    if (
      !cookieToken ||
      !headerToken ||
      !safeCompare(cookieToken, headerToken)
    ) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.CSRF_TOKEN_INVALID,
        'Jeton CSRF manquant ou invalide.',
      );
    }
    return true;
  }
}

function safeCompare(a: string, b: string): boolean {
  const bufferA = Buffer.from(a);
  const bufferB = Buffer.from(b);
  if (bufferA.length !== bufferB.length) return false;
  return timingSafeEqual(bufferA, bufferB);
}
