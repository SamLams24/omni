import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('auth-helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetModules();
  });

  describe('getCurrentUser', () => {
    it('should return null when no user in localStorage', async () => {
      const { getCurrentUser } = await import('@/lib/auth-helpers');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return user object when valid user in localStorage', async () => {
      const mockUser = { id: '123', email: 'test@example.com', name: 'Test' };
      localStorage.setItem('omni_user', JSON.stringify(mockUser));
      
      const { getCurrentUser } = await import('@/lib/auth-helpers');
      const user = getCurrentUser();
      expect(user).toEqual(mockUser);
    });

    it('should return null when localStorage has invalid JSON', async () => {
      localStorage.setItem('omni_user', 'invalid-json');
      
      const { getCurrentUser } = await import('@/lib/auth-helpers');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });

    it('should return null when user object missing id', async () => {
      localStorage.setItem('omni_user', JSON.stringify({ email: 'test@example.com' }));
      
      const { getCurrentUser } = await import('@/lib/auth-helpers');
      const user = getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no user', async () => {
      const { isAuthenticated } = await import('@/lib/auth-helpers');
      expect(isAuthenticated()).toBe(false);
    });

    it('should return true when valid user exists', async () => {
      localStorage.setItem('omni_user', JSON.stringify({ id: '123' }));
      
      const { isAuthenticated } = await import('@/lib/auth-helpers');
      expect(isAuthenticated()).toBe(true);
    });
  });

  describe('clearAuth', () => {
    it('should remove user from localStorage', async () => {
      localStorage.setItem('omni_user', JSON.stringify({ id: '123' }));
      
      const { clearAuth } = await import('@/lib/auth-helpers');
      clearAuth();
      
      expect(localStorage.getItem('omni_user')).toBeNull();
    });
  });
});
