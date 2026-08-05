import { createAuthClient } from '@neondatabase/neon-js/auth';

let authClient;

export function getClientAuthUrl() {
  return (process.env.NEXT_PUBLIC_NEON_AUTH_URL || process.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '') || null;
}

function getAuthClient() {
  const authUrl = getClientAuthUrl();
  if (!authUrl) {
    throw new Error('Authentication is not configured');
  }

  authClient ||= createAuthClient(authUrl);
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

export function signInWithCredentials({ email, password }) {
  return getAuthClient().signIn.email({ email, password });
}

export function signUpWithCredentials({ email, password, name }) {
  return getAuthClient().signUp.email({ email, password, name });
}

export function signOut() {
  return getAuthClient().signOut();
}

export async function checkAuth() {
  const { user } = await getSession();
  return !!user;
}
