import { createAuthClient } from '@neondatabase/neon-js/auth';

let authClient;

export function getClientAuthUrl() {
  return (process.env.NEXT_PUBLIC_NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '') || null;
}

function getAuthClient() {
  const authUrl = getClientAuthUrl();
  if (!authUrl) {
    throw new Error('Authentication is not configured');
  }

  authClient ||= createAuthClient(authUrl, {
    fetchOptions: { credentials: 'include' },
  });
  return authClient;
}

export async function getSession() {
  const result = await getAuthClient().getSession();
  if (result.error) {
    return { user: null, session: null };
  }

  return {
    user: result.data?.user || null,
    session: result.data?.session || null,
  };
}

async function setSessionCookie(token) {
  try {
    await fetch('/api/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ token }),
    });
  } catch (e) {
    console.error('[Auth] Failed to set session cookie:', e);
  }
}

async function clearSessionCookie() {
  try {
    await fetch('/api/auth/clear-session', {
      method: 'POST',
      credentials: 'include',
    });
  } catch (e) {
    console.error('[Auth] Failed to clear session cookie:', e);
  }
}

export async function signInWithCredentials({ email, password }) {
  const client = getAuthClient();
  const result = await client.signIn.email({ email, password });
  if (!result.error) {
    const { data: tokenData } = await client.token();
    if (tokenData?.token) {
      await setSessionCookie(tokenData.token);
    }
  }
  return result;
}

export async function signUpWithCredentials({ email, password, name }) {
  const client = getAuthClient();
  const result = await client.signUp.email({ email, password, name });
  if (!result.error) {
    const { data: tokenData } = await client.token();
    if (tokenData?.token) {
      await setSessionCookie(tokenData.token);
    }
  }
  return result;
}

export async function signOut() {
  const client = getAuthClient();
  const result = await client.signOut();
  await clearSessionCookie();
  return result;
}

export async function checkAuth() {
  const { user } = await getSession();
  return !!user;
}

export async function syncAuthSession() {
  try {
    const client = getAuthClient();
    console.log('[SyncAuth] Calling client.token()...');
    const { data: tokenData, error: tokenError } = await client.token();
    console.log('[SyncAuth] token() result:', tokenData?.token ? `token(${tokenData.token.length} chars)` : 'no token', '| error:', tokenError?.message || 'none');

    if (tokenData?.token) {
      console.log('[SyncAuth] Calling setSessionCookie...');
      await setSessionCookie(tokenData.token);
      console.log('[SyncAuth] Fetching /api/auth/session after set-cookie...');
      const res = await fetch('/api/auth/session', { cache: 'no-store' });
      const result = await res.json();
      console.log('[SyncAuth] Session result:', result?.user ? `user=${result.user.id}` : 'null');
      return result;
    }
    console.log('[SyncAuth] No token from client.token()');
  } catch (e) {
    console.error('[Auth] Failed to sync session:', e);
  }
  return { user: null, session: null };
}
