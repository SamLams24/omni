"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ShoppingBag, Store, Clock, Bike, ChevronRight, Loader2, Heart, Map } from "lucide-react";

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmé",
  partial: "Partiel",
  denied: "Refusé",
  completed: "Terminé",
  cancelled: "Annulé",
};

const STATUS_COLORS = {
  pending: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  confirmed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  partial: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  denied: "text-red-400 bg-red-500/10 border-red-500/20",
  completed: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
  cancelled: "text-zinc-400 bg-zinc-500/10 border-zinc-500/20",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [userName, setUserName] = useState("");
  const [carts, setCarts] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("omni_user") || "{}");
      setUserName(u.name || "Acheteur");
    } catch {}
  }, []);

  useEffect(() => {
    const load = async () => {
      const userId = (() => { try { const u = localStorage.getItem("omni_user"); return u ? JSON.parse(u).id : null; } catch { return null; } })();
      if (!userId) { navigate("/auth"); return; }

      try {
        const [cartRes, favRes] = await Promise.all([
          fetch("/api/cart/history"),
          fetch("/api/favorites"),
        ]);

        if (cartRes.ok) {
          const data = await cartRes.json();
          setCarts(data.carts || []);
        }
        if (favRes.ok) {
          const data = await favRes.json();
          setFavorites(data.favorites || []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [navigate]);

  const activeCarts = carts.filter(c => ["pending", "confirmed", "partial"].includes(c.status));
  const totalOrders = carts.length;
  const pendingDelivery = carts.filter(c => c.delivery && c.delivery.status !== "delivered" && c.delivery.status !== "cancelled").length;

  const stats = [
    { label: "Commandes", value: totalOrders, icon: ShoppingBag, color: "text-emerald-400" },
    { label: "Actives", value: activeCarts.length, icon: Clock, color: "text-amber-400" },
    { label: "Livraisons", value: pendingDelivery, icon: Bike, color: "text-purple-400" },
    { label: "Favoris", value: favorites.length, icon: Heart, color: "text-red-400" },
  ];

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-medium">Bonjour, {userName}</h1>
            <p className="text-white/30 text-sm mt-0.5">Bienvenue sur ton tableau de bord</p>
          </div>
          <Link to="/map" className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-all">
            <Map size={14} />
            Carte
          </Link>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-white/30" />
          </div>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
              {stats.map(s => {
                const Icon = s.icon;
                return (
                  <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Icon size={14} className={s.color} />
                      <span className="text-[10px] text-white/30 uppercase tracking-wider">{s.label}</span>
                    </div>
                    <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
                  </div>
                );
              })}
            </div>

            {/* Active orders */}
            {activeCarts.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-white/70">Commandes en cours</h2>
                  <Link to="/cart/history" className="text-[10px] text-emerald-400/60 hover:text-emerald-400 transition-colors">Voir tout</Link>
                </div>
                <div className="space-y-2">
                  {activeCarts.slice(0, 5).map(cart => (
                    <Link
                      key={cart.id}
                      to="/cart/history"
                      className="block rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-all"
                    >
                      <div className="flex items-center justify-between">
                        <div className="min-w-0 flex-1 mr-3">
                          <p className="text-white text-sm font-medium truncate">{cart.facility_name}</p>
                          <p className="text-white/30 text-[10px]">{cart.vendor_name} · {new Date(cart.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                        </div>
                        <span className={`text-[10px] px-2 py-1 rounded-full border font-medium shrink-0 ${STATUS_COLORS[cart.status] || STATUS_COLORS.pending}`}>
                          {STATUS_LABELS[cart.status] || cart.status}
                        </span>
                      </div>
                      {cart.delivery && (
                        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-white/5">
                          <Bike size={10} className="text-purple-400/60" />
                          <span className="text-[10px] text-purple-400/60">Livraison {cart.delivery.status}</span>
                        </div>
                      )}
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Favorites */}
            {favorites.length > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-sm font-medium text-white/70">Vendeurs favoris</h2>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {favorites.slice(0, 6).map(v => (
                    <Link
                      key={v.id}
                      to="/map"
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-3 hover:border-white/20 transition-all"
                    >
                      <p className="text-white text-sm font-medium truncate">{v.name}</p>
                      <p className="text-white/30 text-[10px] mt-0.5">{v.category}</p>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Empty state */}
            {activeCarts.length === 0 && favorites.length === 0 && (
              <div className="text-center py-16">
                <ShoppingBag size={40} className="mx-auto mb-4 text-zinc-600" />
                <p className="text-white/40 text-sm">Bienvenue sur Omni !</p>
                <p className="text-white/20 text-xs mt-1">Explore la carte pour trouver des facilités près de chez toi</p>
                <Link to="/map" className="inline-flex items-center gap-2 mt-6 px-6 py-3 rounded-xl bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all">
                  Explorer la carte
                  <ChevronRight size={16} />
                </Link>
              </div>
            )}

            {/* Quick links */}
            <section className="grid grid-cols-2 gap-3">
              <Link to="/cart/history" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-all">
                <ShoppingBag size={16} className="text-emerald-400 mb-2" />
                <p className="text-white text-sm font-medium">Mes commandes</p>
                <p className="text-white/30 text-[10px] mt-0.5">Historique complet</p>
              </Link>
              <Link to="/wallet" className="rounded-xl border border-white/10 bg-white/[0.02] p-4 hover:border-white/20 transition-all">
                <Store size={16} className="text-blue-400 mb-2" />
                <p className="text-white text-sm font-medium">Portefeuille</p>
                <p className="text-white/30 text-[10px] mt-0.5">Solde et transactions</p>
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
