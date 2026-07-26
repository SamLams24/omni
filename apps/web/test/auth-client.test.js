import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  getSession: vi.fn(),
  signInEmail: vi.fn(),
  signUpEmail: vi.fn(),
  signOut: vi.fn(),
}));

vi.mock('@neondatabase/neon-js/auth', () => ({
  createAuthClient: mocks.createAuthClient,
}));

import {
  getClientAuthUrl,
  getSession,
  signInWithCredentials,
  signOut,
  signUpWithCredentials,
} from '@/lib/auth-client';

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('NEXT_PUBLIC_NEON_AUTH_URL', 'https://auth.example.test/');
  mocks.createAuthClient.mockReturnValue({
    getSession: mocks.getSession,
    signIn: { email: mocks.signInEmail },
    signUp: { email: mocks.signUpEmail },
    signOut: mocks.signOut,
  });
});

describe('client authentication', () => {
  it('reads and normalizes the public auth URL', () => {
    expect(getClientAuthUrl()).toBe('https://auth.example.test');
  });

  it('returns the authenticated session without exposing provider errors', async () => {
    mocks.getSession.mockResolvedValue({
      data: {
        user: { id: 'user-1', email: 'ama@example.test' },
        session: { id: 'session-1' },
      },
    });

    await expect(getSession()).resolves.toEqual({
      user: { id: 'user-1', email: 'ama@example.test' },
      session: { id: 'session-1' },
    });
  });

  it('delegates credential operations to Neon Auth', async () => {
    mocks.signInEmail.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mocks.signUpEmail.mockResolvedValue({ data: { user: { id: 'user-2' } } });
    mocks.signOut.mockResolvedValue({ data: null });

    await signInWithCredentials({
      email: 'ama@example.test',
      password: 'secret-password',
      callbackUrl: '/map',
    });
    await signUpWithCredentials({
      email: 'kofi@example.test',
      password: 'secret-password',
      name: 'Kofi',
      callbackUrl: '/vendor/onboarding',
    });
    await signOut();

    expect(mocks.signInEmail).toHaveBeenCalledWith({
      email: 'ama@example.test',
      password: 'secret-password',
    });
    expect(mocks.signUpEmail).toHaveBeenCalledWith({
      email: 'kofi@example.test',
      password: 'secret-password',
      name: 'Kofi',
    });
    expect(mocks.signOut).toHaveBeenCalledOnce();
  });
});
