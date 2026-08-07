import { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AppException } from '../../../common/errors/error-codes';

function buildContext(request: Record<string, unknown>, isPublic = false) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(isPublic),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('JwtAuthGuard', () => {
  it('allows a @Public() route through without checking any token', async () => {
    const tokenService = { verifyAccessToken: jest.fn() };
    const { context, reflector } = buildContext({}, true);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('grants access to a protected route with a valid cookie token', async () => {
    const payload = { sub: 'u1', roles: ['BUYER'], permissions: [] };
    const tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue(payload),
    };
    const request: Record<string, unknown> = {
      cookies: { omni_access: 'valid-token' },
      headers: {},
    };
    const { context, reflector } = buildContext(request);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect((request as { user?: unknown }).user).toEqual(payload);
  });

  it('falls back to a well-formed Authorization: Bearer header when no cookie is present', async () => {
    const payload = { sub: 'u1', roles: [], permissions: [] };
    const tokenService = {
      verifyAccessToken: jest.fn().mockResolvedValue(payload),
    };
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: 'Bearer valid-token' },
    };
    const { context, reflector } = buildContext(request);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith('valid-token');
  });

  it('rejects when neither a cookie nor an Authorization header is present', async () => {
    const tokenService = { verifyAccessToken: jest.fn() };
    const request: Record<string, unknown> = { cookies: {}, headers: {} };
    const { context, reflector } = buildContext(request);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).rejects.toThrow(AppException);
  });

  it('rejects a malformed Authorization header instead of sending it to verifyAccessToken', async () => {
    const tokenService = { verifyAccessToken: jest.fn() };
    const request: Record<string, unknown> = {
      cookies: {},
      headers: { authorization: 'Basic not-a-bearer' },
    };
    const { context, reflector } = buildContext(request);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).rejects.toThrow(AppException);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it('rejects an expired/invalid token', async () => {
    const tokenService = {
      verifyAccessToken: jest.fn().mockRejectedValue(new Error('jwt expired')),
    };
    const request: Record<string, unknown> = {
      cookies: { omni_access: 'expired-token' },
      headers: {},
    };
    const { context, reflector } = buildContext(request);
    const guard = new JwtAuthGuard(tokenService as never, reflector);

    await expect(guard.canActivate(context)).rejects.toThrow(AppException);
  });
});
