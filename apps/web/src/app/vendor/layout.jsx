"use client";

import { useState } from "react";
import { Link, useLocation } from "react-router";
import {
  LayoutDashboard,
  Package,
  MessageCircle,
  Bell,
  Settings,
  LogOut,
  Store,
  Map,
  Menu,
  X,
} from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useIsTablet } from "@/hooks/useIsTablet";
import { signOut } from "@/lib/auth-client";

export default function VendorLayout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isMobile = useIsMobile();
  const isTablet = useIsTablet();

  const navItems = [
    { path: "/vendor/dashboard", label: "Tableau de bord", icon: LayoutDashboard },
    { path: "/vendor/products", label: "Mes produits", icon: Package },
    { path: "/vendor/requests", label: "Demandes", icon: Bell },
    { path: "/vendor/messages", label: "Messages", icon: MessageCircle },
  ];

  const bottomItems = [
    { path: "/vendor/settings", label: "Paramètres", icon: Settings },
  ];

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem("omni_user");
    window.location.href = "/";
  };

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className={`flex items-center gap-3 px-6 py-5 border-b border-white/[0.06] ${isTablet ? "justify-center px-3" : ""}`}>
        <Store size={22} className="text-emerald-400 shrink-0" />
        {!isTablet && <span className="font-space-grotesk font-semibold text-base text-white/80">Omni Vendeur</span>}
      </div>

      {/* Map link */}
      {!isTablet && (
        <Link
          to="/map"
          className="flex items-center gap-3 px-6 py-3 text-emerald-400/80 hover:text-emerald-400 text-sm border-b border-white/[0.06] transition-colors font-dm-sans"
        >
          <Map size={16} />
          <span>Voir la carte</span>
        </Link>
      )}

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-dm-sans transition-all ${
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

      {/* Bottom items */}
      <div className="px-3 py-2 space-y-0.5 border-t border-white/[0.06]">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileMenuOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-dm-sans transition-all ${
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
      </div>

      {/* Sign out */}
      <div className="px-3 py-3 border-t border-white/[0.06]">
        <button
          onClick={handleSignOut}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400/60 hover:text-red-400 hover:bg-red-500/[0.06] w-full transition-all font-dm-sans ${isTablet ? "justify-center px-0" : ""}`}
        >
          <LogOut size={18} className="shrink-0" />
          {!isTablet && <span>Déconnexion</span>}
        </button>
      </div>
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

      {/* Sidebar - Desktop: fixed, Tablet: fixed icon rail, Mobile: slide-over drawer */}
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

      {/* Main content - responsive margin */}
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
