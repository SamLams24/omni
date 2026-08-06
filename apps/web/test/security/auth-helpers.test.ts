import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/auth-client', () => ({
  authFetch: vi.fn(),
}));

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null when the server session has no user', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: null, session: null }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(authFetch).toHaveBeenCalledWith('/api/auth/session');
  });

  it('returns the user validated by the server session', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    const user = { id: '123', email: 'test@example.com', name: 'Test' };
    authFetch.mockResolvedValue(Response.json({ user, session: { id: 's1' } }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it('does not use localStorage as an identity fallback', async () => {
    localStorage.setItem('omni_user', JSON.stringify({ id: 'client-controlled-user' }));
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: null, session: null }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the session request fails', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockRejectedValue(new Error('offline'));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('caches a validated user for the configured TTL', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    const user = { id: '123' };
    authFetch.mockResolvedValue(Response.json({ user }));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(authFetch).toHaveBeenCalledOnce();
  });

  it('invalidates the cached user explicitly', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch
      .mockResolvedValueOnce(Response.json({ user: { id: '123' } }))
      .mockResolvedValueOnce(Response.json({ user: null }));

    const { getCurrentUser, invalidateUserCache } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual({ id: '123' });
    invalidateUserCache();
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(authFetch).toHaveBeenCalledTimes(2);
  });

  it('derives authentication state from the server-validated user', async () => {
    const { authFetch } = await import('@/lib/auth-client');
    authFetch.mockResolvedValue(Response.json({ user: { id: '123' } }));

    const { isAuthenticated } = await import('@/lib/auth-helpers');

    await expect(isAuthenticated()).resolves.toBe(true);
  });
});
