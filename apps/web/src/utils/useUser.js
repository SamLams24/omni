import { useState, useEffect, useCallback } from 'react';
import { getSession } from "@/lib/auth-client";

const useUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const session = await getSession();
      if (session.user) {
        // Session is managed by Neon Auth cookies - no localStorage needed
        setUser(session.user);
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
