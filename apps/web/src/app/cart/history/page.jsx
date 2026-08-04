"use client";

import { useState, useEffect } from "react";
import { ShoppingBag, ChevronLeft, Check, X, Clock, Loader2, MessageCircle, Bike } from "lucide-react";
import { Link } from "react-router";
import ChatModal from "@/components/ChatModal";
import { toast } from "sonner";

const STATUS_LABELS = {
  pending: "En attente",
  confirmed: "Confirmé",
  partial: "Partiellement confirmé",
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

const DELIVERY_LABELS = {
  pending: "En attente",
  looking: "🔍 Recherche livreur",
  matched: "📦 Livreur trouvé",
  assigned: "🛵 Prise en charge",
  picked_up: "📦 En cours de livraison",
  in_transit: "🚚 En route",
  delivered: "✅ Livré",
};

export default function CartHistory() {
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [chatRequest, setChatRequest] = useState(null);

  useEffect(() => {
    fetchCarts(true);
    const interval = setInterval(() => fetchCarts(), 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchCarts = async (isInitial = false) => {
    if (isInitial) setLoading(true);
    try {
      const authRes = await fetch("/api/auth/session", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData?.user) {
        window.location.href = "/auth";
        return;
      }

      const res = await fetch("/api/cart/history");

      if (!res.ok) throw new Error("Failed to load carts");
      const data = await res.json();
      setCarts(data.carts || []);
    } catch (err) {
      console.error(err);
      setError("Erreur lors du chargement de l'historique");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-neutral-950/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <Link to="/map" className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center">
            <ChevronLeft size={16} className="text-white/50" />
          </Link>
          <h1 className="text-lg font-medium">Mes commandes</h1>
          {carts.length > 0 && (
            <span className="text-xs text-white/30 ml-auto">{carts.length} commande{carts.length > 1 ? "s" : ""}</span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-white/30" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-red-400/60 text-sm">{error}</p>
            <button onClick={fetchCarts} className="mt-4 text-sm text-emerald-400 hover:underline">
              Réessayer
            </button>
          </div>
        ) : carts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <ShoppingBag size={24} className="text-white/30" />
            </div>
            <p className="text-white/30 text-sm">Aucune commande</p>
            <p className="text-white/10 text-xs mt-1">Envoie un panier depuis la carte pour voir ton historique</p>
            <Link to="/map" className="inline-block mt-6 px-6 py-2.5 rounded-full bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-all">
              Voir la carte
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {carts.map((cart) => (
              <div key={cart.id} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden transition-all hover:border-white/20">
                {/* Header */}
                <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-white text-sm font-medium truncate">{cart.facility_name}</h3>
                    <p className="text-white/30 text-xs">{cart.vendor_name}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full border font-medium shrink-0 ml-3 ${STATUS_COLORS[cart.status] || STATUS_COLORS.pending}`}>
                    {STATUS_LABELS[cart.status] || cart.status}
                  </span>
                </div>

                {/* Items */}
                <div className="divide-y divide-white/5">
                  {cart.items.map((item) => (
                    <div key={item.id} className="px-4 py-2.5 flex items-center justify-between">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-white/70 text-sm truncate">{item.product_name}</p>
                        <p className="text-white/30 text-xs mt-0.5">
                          {item.quantity_requested} x {item.product_price?.toLocaleString()} FCFA
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.status === 'confirmed' && (
                          <span className="flex items-center gap-1 text-[10px] text-emerald-400/60">
                            <Check size={10} />
                            {item.quantity_confirmed || item.quantity_requested}
                          </span>
                        )}
                        {item.status === 'denied' && (
                          <X size={12} className="text-red-400/40" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                  {/* Info */}
                  <div className="px-4 py-2.5 border-t border-white/5 bg-white/[0.01]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2 text-[10px] text-white/20">
                        <Clock size={10} />
                        <span>{new Date(cart.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        <span>·</span>
                        <span>{cart.payment_method === "escrow" ? "Balance" : "Cash"}</span>
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            const authRes = await fetch("/api/auth/session", { cache: "no-store" });
                            const authData = await authRes.json();
                            if (!authData?.user) { window.location.href = "/auth"; return; }
                            fetch("/api/availability/request", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ vendorId: cart.vendor_id, facilityId: cart.facility_id, productId: cart.items[0]?.product_id, quantity: 1 }),
                          }).then(r => r.json()).then(data => setChatRequest(data.request)).catch(() => {});
                        }}
                        className="flex items-center gap-1 text-[10px] text-emerald-400/60 hover:text-emerald-400 transition-colors"
                      >
                        <MessageCircle size={10} />
                        Contacter
                      </button>
                    </div>

                    {/* Delivery tracking */}
                    {cart.delivery && (
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                        <Bike size={12} className="text-emerald-400 shrink-0" />
                        <span className="text-[10px] text-emerald-400/80">
                          {DELIVERY_LABELS[cart.delivery.status] || cart.delivery.status}
                          {cart.delivery.dropoff_address ? ` → ${cart.delivery.dropoff_address}` : ""}
                        </span>
                        {cart.delivery.delivery_fee > 0 && (
                          <span className="text-[10px] text-emerald-400/60 ml-auto">+{cart.delivery.delivery_fee} FCFA</span>
                        )}
                      </div>
                    )}
                  {(cart.status === 'confirmed' || cart.status === 'partial') && (
                    <div className="flex gap-2">
                      <button
                        onClick={async () => {
                          try {
                            const authRes = await fetch("/api/auth/session", { cache: "no-store" });
                            const authData = await authRes.json();
                            if (!authData?.user) { window.location.href = "/auth"; return; }
                            const res = await fetch(`/api/cart/${cart.id}/received`, {
                              method: "POST",
                            });
                            if (res.ok) { toast("Commande marquée reçue"); fetchCarts(); }
                            else { toast("Erreur"); }
                          } catch { toast("Erreur"); }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-medium hover:bg-emerald-500/20 transition-all"
                      >
                        Marquer reçu
                      </button>
                      <button
                        onClick={async () => {
                          try {
                            const authRes = await fetch("/api/auth/session", { cache: "no-store" });
                            const authData = await authRes.json();
                            if (!authData?.user) { window.location.href = "/auth"; return; }
                            const res = await fetch(`/api/cart/${cart.id}/cancel`, {
                              method: "POST",
                            });
                            if (res.ok) { toast("Commande annulée"); fetchCarts(); }
                            else { toast("Erreur"); }
                          } catch { toast("Erreur"); }
                        }}
                        className="flex-1 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-all"
                      >
                        Annuler
                      </button>
                    </div>
                  )}
                  {cart.status === 'pending' && (
                    <button
                      onClick={async () => {
                        try {
                          const authRes = await fetch("/api/auth/session", { cache: "no-store" });
                          const authData = await authRes.json();
                          if (!authData?.user) { window.location.href = "/auth"; return; }
                          const res = await fetch(`/api/cart/${cart.id}/cancel`, {
                            method: "POST",
                          });
                          if (res.ok) { toast("Commande annulée"); fetchCarts(); }
                          else { toast("Erreur"); }
                        } catch { toast("Erreur"); }
                      }}
                      className="w-full py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-[10px] font-medium hover:bg-red-500/20 transition-all"
                    >
                      Annuler la demande
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chat Modal */}
      {chatRequest && (
        <ChatModal
          requestId={chatRequest.id}
          vendorName={carts.find(c => c.items[0]?.product_id === chatRequest.product_id)?.vendor_name || "Vendeur"}
          onClose={() => setChatRequest(null)}
        />
      )}
    </div>
  );
}
