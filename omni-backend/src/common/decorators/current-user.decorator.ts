import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AccessTokenPayload } from '../../modules/auth/token.service';

/** Reads the JWT payload JwtAuthGuard attached to the request. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    const request = ctx
      .switchToHttp()
      .getRequest<Request & { user: AccessTokenPayload }>();
    return request.user;
  },
);
