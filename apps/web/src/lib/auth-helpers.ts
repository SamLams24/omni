interface User {
  id: string;
  email?: string;
  name?: string;
}

const STORAGE_KEY = 'omni_user';

export function getCurrentUser(): User | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    
    const user = JSON.parse(stored);
    if (!user || typeof user.id !== 'string') return null;
    
    return user;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getCurrentUser() !== null;
}

export function clearAuth(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function setUser(user: User): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
}
