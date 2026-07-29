import { useState, useEffect, useCallback } from 'react';
import { getSession } from "@/lib/auth-client";

const useUser = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const session = await getSession();
      if (session.user) {
        localStorage.setItem("omni_user", JSON.stringify(session.user));
        setUser(session.user);
      } else {
        localStorage.removeItem("omni_user");
        setUser(null);
      }
    } catch {
      localStorage.removeItem("omni_user");
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
