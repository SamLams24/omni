import { useState, useEffect, useCallback } from 'react';

const useUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const { authFetch } = await import("@/lib/auth-client");
      const res = await authFetch("/api/auth/session");
      const data = await res.json();
      if (data?.user) {
        setUser(data.user);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refetch = useCallback(() => {
    setLoading(true);
    fetchUser();
  }, [fetchUser]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { 
    user, 
    data: user, 
    loading, 
    refetch 
  };
};

export { useUser };
export default useUser;
