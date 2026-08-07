import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { RolesGuard } from './roles.guard';
import { AppException } from '../../../common/errors/error-codes';

function buildContext(
  user: { roles: string[] } | undefined,
  requiredRoles: string[] | undefined,
) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredRoles),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('RolesGuard', () => {
  it('allows access when no roles are required on the route', () => {
    const { context, reflector } = buildContext(
      { roles: ['BUYER'] },
      undefined,
    );
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows access when the user has one of the required roles', () => {
    const { context, reflector } = buildContext(
      { roles: ['SELLER', 'BUYER'] },
      ['ADMIN', 'SELLER'],
    );
    expect(new RolesGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects when the user has none of the required roles', () => {
    const { context, reflector } = buildContext({ roles: ['BUYER'] }, [
      'ADMIN',
      'SUPER_ADMIN',
    ]);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      AppException,
    );
  });

  it('rejects when the user has no roles at all', () => {
    const { context, reflector } = buildContext(undefined, ['ADMIN']);
    expect(() => new RolesGuard(reflector).canActivate(context)).toThrow(
      AppException,
    );
  });
});
