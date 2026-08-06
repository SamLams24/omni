import { afterEach, describe, expect, it, vi } from 'vitest';
import { getServerSession } from '@/lib/auth';

function stubOkSession(fetchMock) {
  fetchMock.mockResolvedValue(
    Response.json({ user: { id: 'u1', name: 'Ama' }, session: { id: 's1' } })
  );
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('getServerSession token resolution', () => {
  it('falls back to the Bearer token when no cookie is present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Bearer bearer-token-value' },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer bearer-token-value' }),
      })
    );
  });

  it('prefers the omni_session cookie over a Bearer header when both are present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: {
        cookie: 'omni_session=cookie-token-value',
        authorization: 'Bearer bearer-token-value',
      },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer cookie-token-value' }),
      })
    );
  });

  it('ignores a malformed Authorization header instead of sending "Bearer undefined"', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Basic not-a-bearer-token' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an empty Bearer token as unauthenticated', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: 'Bearer    ' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from the Bearer token', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    stubOkSession(fetchMock);
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { authorization: '  Bearer   spaced-token  ' },
    });

    await getServerSession(request);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://auth.example.test/get-session',
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: 'Bearer spaced-token' }),
      })
    );
  });

  it('returns null when neither a cookie nor an Authorization header is present', async () => {
    vi.stubEnv('NEON_AUTH_URL', 'https://auth.example.test');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      getServerSession(new Request('https://omni.test/api/profile'))
    ).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns null when NEON_AUTH_URL is not configured, even with a valid token', async () => {
    vi.stubEnv('NEON_AUTH_URL', '');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://omni.test/api/profile', {
      headers: { cookie: 'omni_session=some-token' },
    });

    await expect(getServerSession(request)).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
