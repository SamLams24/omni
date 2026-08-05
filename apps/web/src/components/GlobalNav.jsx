"use client";

import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router";
import { Menu, X, Store, Truck, Wallet, Crown, User, LogIn, Map, LayoutDashboard } from "lucide-react";

export default function GlobalNav() {
  const [open, setOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userName, setUserName] = useState(null);
  const [balance, setBalance] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        let data;
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        data = await res.json();

        if (!data?.user) {
          const { syncAuthSession } = await import("@/lib/auth-client");
          data = await syncAuthSession();
        }

        if (data?.user) {
          setIsAuthenticated(true);
          setUserName(data.user.name);
        }
      } catch {}
      setAuthLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/wallet/balance");
        if (res.ok) { const d = await res.json(); setBalance(d.balance); }
      } catch {}
    };
    fetchBalance();
  }, [isAuthenticated]);

  const go = (path) => {
    setOpen(false);
    navigate(path);
  };

  const handleRoleSwitch = async (role) => {
    setOpen(false);
    if (role === "vendor") {
      try {
        const authRes = await fetch("/api/auth/session", { cache: "no-store" });
        const authData = await authRes.json();
        if (!authData?.user) { navigate("/auth"); return; }
        const res = await fetch("/api/vendors/my-vendor");
        if (!res.ok) { navigate("/vendor/onboarding"); return; }
        const data = await res.json();
        if (data.vendor) navigate("/vendor/dashboard");
        else navigate("/vendor/onboarding");
      } catch { navigate("/vendor/onboarding"); }
    } else if (role === "delivery") {
      try {
        const authRes = await fetch("/api/auth/session", { cache: "no-store" });
        const authData = await authRes.json();
        if (!authData?.user) { navigate("/auth"); return; }
        const res = await fetch("/api/delivery/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.profile) navigate("/delivery/dashboard");
          else navigate("/delivery/onboarding");
        } else {
          navigate("/delivery/onboarding");
        }
      } catch { navigate("/delivery/onboarding"); }
    } else {
      navigate("/map");
    }
  };

  // Don't render on pages that have their own navigation
  if (location.pathname === "/map" ||
      location.pathname === "/" ||
      location.pathname.startsWith("/vendor/") ||
      location.pathname.startsWith("/delivery/") ||
      location.pathname.startsWith("/subscriptions")) return null;

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="fixed top-4 right-4 z-40 w-9 h-9 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all"
      >
        <Menu size={16} className="text-white/70" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative w-72 max-w-[85vw] h-full bg-neutral-950 border-r border-white/10 shadow-2xl animate-slide-right">
            <div className="p-5">
              <div className="flex items-center justify-between mb-8">
                <span className="text-white font-medium text-sm">Omni</span>
                <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 transition-all">
                  <X size={14} className="text-white/50" />
                </button>
              </div>

              {authLoading ? (
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-white/5 animate-pulse" />
                  <div className="space-y-1.5">
                    <div className="h-3 w-20 bg-white/5 rounded animate-pulse" />
                    <div className="h-2 w-12 bg-white/5 rounded animate-pulse" />
                  </div>
                </div>
              ) : isAuthenticated ? (
                <div className="flex items-center gap-3 mb-6 pb-6 border-b border-white/5">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <span className="text-emerald-400 text-sm font-medium">{userName?.[0]?.toUpperCase() || "U"}</span>
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{userName || "Utilisateur"}</p>
                    <p className="text-white/20 text-[10px]">Connecté</p>
                  </div>
                </div>
              ) : (
                <button onClick={() => go("/auth")}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium mb-6"
                >
                  <LogIn size={16} /> Se connecter
                </button>
              )}

              <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Mon rôle</p>
              <div className="space-y-1 mb-6">
                {[
                  { role: "buyer", label: "Acheteur", icon: Map, color: "text-emerald-400" },
                  { role: "vendor", label: "Vendeur", icon: Store, color: "text-blue-400" },
                  { role: "delivery", label: "Livreur", icon: Truck, color: "text-purple-400" },
                ].map((r) => {
                  const Icon = r.icon;
                  return (
                    <button key={r.role} onClick={() => handleRoleSwitch(r.role)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all"
                    >
                      <Icon size={16} className={r.color} />
                      <span className="text-white/70 text-sm">{r.label}</span>
                    </button>
                  );
                })}
              </div>

              <p className="text-[10px] text-white/20 uppercase tracking-widest mb-3">Liens</p>
              <div className="space-y-1">
                {[
                  { label: "Tableau de bord", icon: LayoutDashboard, path: "/dashboard" },
                  { label: "Portefeuille", icon: Wallet, path: "/wallet", desc: balance != null ? `${balance.toLocaleString()} FCFA` : null },
                  { label: "Abonnements", icon: Crown, path: "/subscriptions" },
                  { label: "Mon compte", icon: User, path: "/user/profile" },
                ].map((l) => {
                  const Icon = l.icon;
                  return (
                    <button key={l.label} onClick={() => go(l.path)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/5 transition-all"
                    >
                      <Icon size={16} className="text-white/40" />
                      <span className="text-white/60 text-sm flex-1 text-left">{l.label}</span>
                      {l.desc && <span className="text-[10px] text-emerald-400/60">{l.desc}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes slide-right {
          from { transform: translateX(-100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .animate-slide-right { animation: slide-right 0.2s ease-out; }
      `}</style>
    </>
  );
}
