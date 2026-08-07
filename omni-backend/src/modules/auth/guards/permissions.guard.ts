import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSIONS_KEY } from '../../../common/decorators/permissions.decorator';
import { AppException, ErrorCode } from '../../../common/errors/error-codes';
import type { AccessTokenPayload } from '../token.service';

/** Runs after JwtAuthGuard -- requires request.user to already be set. */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!requiredPermissions || requiredPermissions.length === 0) return true;

    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AccessTokenPayload }>();
    const userPermissions = request.user?.permissions ?? [];
    const hasAll = requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );

    if (!hasAll) {
      throw new AppException(
        HttpStatus.FORBIDDEN,
        ErrorCode.AUTH_FORBIDDEN,
        "Vous n'avez pas l'autorisation d'effectuer cette action.",
      );
    }
    return true;
  }
}
