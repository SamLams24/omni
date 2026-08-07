import type { Reflector } from '@nestjs/core';
import type { ExecutionContext } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';
import { AppException } from '../errors/error-codes';

function buildContext(
  method: string,
  headers: Record<string, string>,
  cookies: Record<string, string>,
  skip = false,
) {
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(skip),
  } as unknown as Reflector;
  const context = {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({ method, headers, cookies }) }),
  } as unknown as ExecutionContext;
  return { context, reflector };
}

describe('CsrfGuard', () => {
  it('allows safe methods (GET) through without checking any token', () => {
    const { context, reflector } = buildContext('GET', {}, {});
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });

  it('allows a mutating request when the cookie and header tokens match', () => {
    const { context, reflector } = buildContext(
      'POST',
      { 'x-csrf-token': 'matching-token' },
      { omni_csrf: 'matching-token' },
    );
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });

  it('rejects a mutating request when the header token is missing', () => {
    const { context, reflector } = buildContext(
      'POST',
      {},
      { omni_csrf: 'cookie-token' },
    );
    expect(() => new CsrfGuard(reflector).canActivate(context)).toThrow(
      AppException,
    );
  });

  it("rejects a mutating request when the cookie and header tokens don't match", () => {
    const { context, reflector } = buildContext(
      'POST',
      { 'x-csrf-token': 'attacker-guess' },
      { omni_csrf: 'real-token' },
    );
    expect(() => new CsrfGuard(reflector).canActivate(context)).toThrow(
      AppException,
    );
  });

  it('allows a @SkipCsrf() route through even without matching tokens (e.g. webhooks)', () => {
    const { context, reflector } = buildContext('POST', {}, {}, true);
    expect(new CsrfGuard(reflector).canActivate(context)).toBe(true);
  });
});
