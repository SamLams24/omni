import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (path) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

describe('authentication surface', () => {
  it('does not ship the fixed OTP demonstration endpoints', () => {
    const removedPaths = [
      'src/app/api/auth/send-otp/route.js',
      'src/app/api/auth/verify-otp/route.js',
      'src/lib/simple-auth.js',
      'simple-server.js',
      'test-auth.html',
    ];

    for (const path of removedPaths) {
      expect(existsSync(resolve(process.cwd(), path)), path).toBe(false);
    }
  });

  it('does not hardcode an auth tenant or log session data', () => {
    const client = readSource('../src/lib/auth-client.js');
    const route = readSource('../src/app/api/auth/session/route.js');

    expect(client).toContain('NEXT_PUBLIC_NEON_AUTH_URL');
    expect(client).not.toMatch(/neonauth\.[^'"]+/);
    expect(route).not.toContain('createAuthClient');
    expect(route).not.toContain('console.');
    expect(route).not.toContain("headers.get('cookie')");
  });

  it('does not derive protected screen identity from the local cache', () => {
    const protectedScreens = [
      '../src/app/settings/page.jsx',
      '../src/app/user/profile/page.jsx',
      '../src/app/vendor/onboarding/page.jsx',
    ];

    for (const path of protectedScreens) {
      const source = readSource(path);
      expect(source, path).not.toContain('x-user-id');
      expect(source, path).not.toMatch(/localStorage\.getItem\(["']omni_user/);
    }
  });
});
