interface User {
  id: string;
  email?: string;
  name?: string;
}

let cachedUser: User | null = null;
let cacheTime = 0;
const CACHE_TTL = 30_000;

export async function getCurrentUser(): Promise<User | null> {
  const now = Date.now();
  if (cachedUser && now - cacheTime < CACHE_TTL) return cachedUser;

  try {
    const { authFetch } = await import("@/lib/auth-client");
    const res = await authFetch("/api/auth/session");
    const data = await res.json();
    const user = data?.user || null;
    cachedUser = user;
    cacheTime = now;
    return user;
  } catch {
    cachedUser = null;
    return null;
  }
}

export function invalidateUserCache(): void {
  cachedUser = null;
  cacheTime = 0;
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getCurrentUser();
  return user !== null;
}
