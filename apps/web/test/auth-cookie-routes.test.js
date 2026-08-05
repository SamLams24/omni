import { describe, expect, it } from 'vitest';
import { POST as clearSession } from '@/app/api/auth/clear-session/route';
import { POST as setSession } from '@/app/api/auth/set-session/route';

describe('authentication cookie bridge', () => {
  it('stores an encoded token in a protected non-cacheable cookie', async () => {
    const response = await setSession(
      new Request('https://omni.test/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'valid.token;value' }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('set-cookie')).toContain(
      'omni_session=valid.token%3Bvalue',
    );
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('SameSite=Lax');
  });

  it('rejects missing and oversized tokens', async () => {
    const missing = await setSession(
      new Request('https://omni.test/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      }),
    );
    const oversized = await setSession(
      new Request('https://omni.test/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: 'x'.repeat(8193) }),
      }),
    );

    expect(missing.status).toBe(400);
    expect(oversized.status).toBe(400);
  });

  it('expires the protected session cookie on sign-out', async () => {
    const response = await clearSession();

    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('omni_session=;');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
  });
});
