import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { PermissionsGuard } from './permissions.guard';
import { AppException } from '../../../common/errors/error-codes';

function buildContext(
  user: { permissions: string[] } | undefined,
  requiredPermissions: string[] | undefined,
) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(requiredPermissions),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('PermissionsGuard', () => {
  it('allows access when no permissions are required on the route', () => {
    const { context, reflector } = buildContext({ permissions: [] }, undefined);
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows access when the user has ALL required permissions', () => {
    const { context, reflector } = buildContext(
      { permissions: ['kyc.read', 'kyc.approve', 'kyc.reject'] },
      ['kyc.read', 'kyc.approve'],
    );
    expect(new PermissionsGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects when the user is missing even one required permission', () => {
    const { context, reflector } = buildContext({ permissions: ['kyc.read'] }, [
      'kyc.read',
      'kyc.approve',
    ]);
    expect(() => new PermissionsGuard(reflector).canActivate(context)).toThrow(
      AppException,
    );
  });
});
