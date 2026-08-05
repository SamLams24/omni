import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('auth-helpers', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null when the server session has no user', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({ user: null, session: null }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/session',
      { cache: 'no-store' },
    );
  });

  it('returns the user validated by the server session', async () => {
    const user = { id: '123', email: 'test@example.com', name: 'Test' };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ user, session: { id: 's1' } })),
    );

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
  });

  it('does not use localStorage as an identity fallback', async () => {
    localStorage.setItem(
      'omni_user',
      JSON.stringify({ id: 'client-controlled-user' }),
    );
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ user: null, session: null })),
    );

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('returns null when the session request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toBeNull();
  });

  it('caches a validated user for the configured TTL', async () => {
    const user = { id: '123' };
    const fetchMock = vi.fn().mockResolvedValue(Response.json({ user }));
    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser } = await import('@/lib/auth-helpers');

    await expect(getCurrentUser()).resolves.toEqual(user);
    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it('invalidates the cached user explicitly', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ user: { id: '123' } }))
      .mockResolvedValueOnce(Response.json({ user: null }));
    vi.stubGlobal('fetch', fetchMock);

    const { getCurrentUser, invalidateUserCache } = await import(
      '@/lib/auth-helpers'
    );

    await expect(getCurrentUser()).resolves.toEqual({ id: '123' });
    invalidateUserCache();
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('derives authentication state from the server-validated user', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(Response.json({ user: { id: '123' } })),
    );

    const { isAuthenticated } = await import('@/lib/auth-helpers');

    await expect(isAuthenticated()).resolves.toBe(true);
  });
});
