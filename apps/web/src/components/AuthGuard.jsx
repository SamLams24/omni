"use client";

import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";
import { Loader2 } from "lucide-react";

export function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkSession = async () => {
      try {
        const { getSession } = await import('@/lib/auth-client');
        const session = await getSession();
        if (session?.user) {
          setIsAuthenticated(true);
          setIsLoading(false);
          return;
        }
      } catch {}
      const callback = encodeURIComponent(location.pathname + location.search);
      navigate(`/auth?callbackUrl=${callback}`, { replace: true });
    };
    
    checkSession();
  }, [navigate, location]);

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#050510]">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-emerald-500 mx-auto mb-4" />
          <p className="text-white/60 text-sm">Vérification...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
