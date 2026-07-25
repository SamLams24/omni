import { afterEach, describe, expect, it, vi } from 'vitest';
import { getAuthenticatedUser, getServerSession } from '@/lib/auth';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('server authentication', () => {
  it('does not trust x-user-id without a server session', async () => {
    vi.stubEnv('NEON_AUTH_URL', '');
    const request = new Request('https://omni.test/api/profile', {
      headers: {
        'x-user-id': 'impersonated-user',
      },
    });

    await expect(getAuthenticatedUser(request)).resolves.toBeNull();
  });

  it('requires a cookie before calling the auth service', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const session = await getServerSession(
      new Request('https://omni.test/api/profile')
    );

    expect(session).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns the user validated by the auth service', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test/');
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        user: {
          id: '17ce39d2-d9f6-4ae5-80d6-a12889e6a40b',
          name: 'Ama',
          email: 'ama@example.test',
        },
        session: {
          id: 'session-1',
        },
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: {
        cookie: 'omni.session=server-validated-token',
        'x-user-id': 'ignored-attacker-value',
      },
    });

    await expect(getAuthenticatedUser(request)).resolves.toMatchObject({
      id: '17ce39d2-d9f6-4ae5-80d6-a12889e6a40b',
      name: 'Ama',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        cache: 'no-store',
        headers: expect.objectContaining({
          cookie: 'omni.session=server-validated-token',
        }),
      })
    );
  });

  it('rejects unsuccessful auth responses', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 401 }))
    );

    const request = new Request('https://omni.test/api/profile', {
      headers: {
        cookie: 'omni.session=invalid',
      },
    });

    await expect(getAuthenticatedUser(request)).resolves.toBeNull();
  });
});
