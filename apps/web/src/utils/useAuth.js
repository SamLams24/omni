import { useCallback, useState, useEffect } from 'react';
import { useNavigate } from 'react-router';

function useAuth() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { authFetch } = await import('@/lib/auth-client');
        const res = await authFetch('/api/auth/session');
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
          setLoading(false);
          return;
        }
      } catch {}
      setUser(null);
      setLoading(false);
    };
    checkSession();
  }, []);

  const signIn = useCallback(() => {
    navigate('/auth');
  }, [navigate]);

  const signUp = useCallback(() => {
    navigate('/auth');
  }, [navigate]);

  const signOut = useCallback(async () => {
    const { signOut: apiSignOut } = await import('@/lib/auth-client');
    await apiSignOut();
    // Session is managed by Neon Auth cookies - no localStorage to clear
    setUser(null);
    navigate('/');
  }, [navigate]);

  const signInWithCredentials = useCallback(async (options) => {
    const { signInWithCredentials: authenticate } = await import('@/lib/auth-client');
    const result = await authenticate(options);
    if (result.error) {
      throw new Error(result.error.message || 'Authentication failed');
    }

    const authenticatedUser = result.data?.user || null;
    if (authenticatedUser) {
      // Session is managed by Neon Auth cookies - no localStorage needed
      setUser(authenticatedUser);
    }
    if (options.redirect !== false) {
      navigate(options.callbackUrl || '/map');
    }
    return result;
  }, [navigate]);

  const signUpWithCredentials = useCallback(async (options) => {
    const { signUpWithCredentials: register } = await import('@/lib/auth-client');
    const result = await register(options);
    if (result.error) {
      throw new Error(result.error.message || 'Registration failed');
    }

    const authenticatedUser = result.data?.user || null;
    if (authenticatedUser) {
      // Session is managed by Neon Auth cookies - no localStorage needed
      setUser(authenticatedUser);
    }
    if (options.redirect !== false) {
      navigate(options.callbackUrl || '/map');
    }
    return result;
  }, [navigate]);

  const refreshSession = useCallback(async () => {
    const { authFetch } = await import('@/lib/auth-client');
    const res = await authFetch('/api/auth/session');
    const data = await res.json();
    setUser(data?.user || null);
    return data;
  }, []);

  return {
    user,
    loading,
    signIn,
    signUp,
    signOut,
    signInWithCredentials,
    signUpWithCredentials,
    refreshSession,
  };
}

export default useAuth;
