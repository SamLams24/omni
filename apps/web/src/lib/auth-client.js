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

export async function getAuthToken() {
  try {
    const client = getAuthClient();
    const { data, error } = await client.token();
    if (error || !data?.token) return null;
    return data.token;
  } catch {
    return null;
  }
}

export async function authFetch(url, options = {}) {
  const token = await getAuthToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...options, headers, credentials: 'omit' });
}

export async function signInWithCredentials({ email, password }) {
  const client = getAuthClient();
  return await client.signIn.email({ email, password });
}

export async function signUpWithCredentials({ email, password, name }) {
  const client = getAuthClient();
  return await client.signUp.email({ email, password, name });
}

export async function signOut() {
  const client = getAuthClient();
  return await client.signOut();
}

export async function checkAuth() {
  const { user } = await getSession();
  return !!user;
}
