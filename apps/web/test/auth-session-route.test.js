import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET, POST } from '@/app/api/auth/session/route';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('authentication session route', () => {
  it('returns an empty non-cacheable session without a validated cookie', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('https://omni.test/api/auth/session')
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      user: null,
      session: null,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns only a session validated by the server auth service', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        Response.json({
          user: { id: 'user-1', email: 'ama@example.test' },
          session: { id: 'session-1' },
        })
      )
    );

    const response = await GET(
      new Request('https://omni.test/api/auth/session', {
        headers: { cookie: 'omni_session=validated-token' },
      })
    );

    await expect(response.json()).resolves.toEqual({
      user: { id: 'user-1', email: 'ama@example.test' },
      session: { id: 'session-1' },
    });
  });

  it('rejects server-side sign-out that cannot forward browser auth state', async () => {
    const response = await POST();

    expect(response.status).toBe(405);
    expect(response.headers.get('allow')).toBe('GET');
  });
});
