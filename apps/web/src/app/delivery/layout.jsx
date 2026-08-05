"use client";

import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router";
import { LayoutDashboard, History, Settings, Map, Menu, X, Bike } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsTablet } from "@/hooks/useIsTablet";

export default function DeliveryLayout({ children }) {
  const pathname = useLocation().pathname;
  const [userName, setUserName] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(r => r.json())
      .then(data => setUserName(data?.user?.name || "Livreur"))
      .catch(() => setUserName("Livreur"));
  }, []);

  const navItems = [
    { href: "/delivery/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/delivery/history", label: "Historique", icon: History },
    { href: "/delivery/settings", label: "Paramètres", icon: Settings },
  ];

  const sidebarContent = (
    <>
      <div className={`flex items-center gap-3 px-6 py-5 border-b border-white/[0.06] ${isTablet ? "justify-center px-3" : ""}`}>
        <Bike size={22} className="text-emerald-400 shrink-0" />
        {!isTablet && (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-space-grotesk font-semibold text-base text-white/80">Omni</span>
              <span className="text-[10px] text-emerald-400/60 font-medium">Livreur</span>
            </div>
            <p className="text-[10px] text-white/30 truncate">{userName}</p>
          </div>
        )}
      </div>

      {!isTablet && (
        <Link
          to="/map"
          className="flex items-center gap-3 px-6 py-3 text-emerald-400/80 hover:text-emerald-400 text-sm border-b border-white/[0.06] transition-colors"
        >
          <Map size={16} />
          <span>Voir la carte</span>
        </Link>
      )}

      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              to={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-white/40 hover:text-white/70 hover:bg-white/[0.03]"
              } ${isTablet ? "justify-center px-0" : ""}`}
            >
              <Icon size={18} className="shrink-0" />
              {!isTablet && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Map link for tablet */}
      {isTablet && (
        <div className="px-3 py-2 border-t border-white/[0.06]">
          <Link
            to="/map"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center justify-center px-3 py-2.5 rounded-xl text-emerald-400/60 hover:text-emerald-400 hover:bg-white/[0.03] transition-all"
          >
            <Map size={18} />
          </Link>
        </div>
      )}
    </>
  );

  return (
    <div className="flex min-h-screen bg-[#08080f]">
      {/* Mobile overlay */}
      {isMobile && mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Hamburger button (mobile only) */}
      {isMobile && (
        <button
          onClick={() => setMobileMenuOpen(prev => !prev)}
          className="fixed top-4 left-4 z-50 w-10 h-10 rounded-xl bg-[#08080f] border border-white/[0.06] flex items-center justify-center"
        >
          {mobileMenuOpen ? <X size={18} className="text-white/70" /> : <Menu size={18} className="text-white/70" />}
        </button>
      )}

      {/* Sidebar */}
      <aside
        className={`${
          isMobile
            ? `fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
                mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
              }`
            : isTablet
            ? "w-16 fixed h-screen"
            : "w-64 fixed h-screen"
        } flex flex-col border-r border-white/[0.06] bg-[#08080f]`}
      >
        {sidebarContent}
      </aside>

      {/* Main */}
      <main
        className={`flex-1 min-h-screen bg-[#0e0e18] ${
          isMobile ? "ml-0 pt-16" : isTablet ? "ml-16" : "ml-64"
        }`}
      >
        {children}
      </main>
    </div>
  );
}
