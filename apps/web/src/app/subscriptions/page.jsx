"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Store, Truck, Crown, Check, Loader2 } from "lucide-react";

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [vendorTier, setVendorTier] = useState("free");
  const [deliveryTier, setDeliveryTier] = useState("free");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (!data?.user) { navigate("/auth"); return; }
        loadData();
      })
      .catch(() => navigate("/auth"));
  }, []);

  const loadData = async () => {
    try {
      const subRes = await fetch("/api/subscriptions/status");
      if (subRes.ok) {
        const sd = await subRes.json();
        setVendorTier(sd.vendorTier || "free");
        setDeliveryTier(sd.deliveryTier || "free");
      }
    } catch {} finally { setLoading(false); }
  };

  if (loading) {
    return <div className="min-h-screen bg-neutral-950 flex items-center justify-center"><Loader2 size={24} className="animate-spin text-white/30" /></div>;
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <Link to="/map" className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <ArrowLeft size={14} className="text-white/50" />
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Crown size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-medium">Abonnements</h1>
            <p className="text-white/30 text-sm">Débloque toutes les fonctionnalités</p>
          </div>
        </div>

        <div className="px-4 py-3 rounded-xl bg-amber-500/5 border border-amber-500/10 mb-6">
          <p className="text-xs text-amber-200/70">
            Les offres Premium sont en cours de finalisation. Aucun paiement ni changement de formule n’est actuellement proposé.
          </p>
        </div>

        {/* Vendor subscription */}
        <div className={`rounded-2xl border p-5 mb-4 ${vendorTier === "premium" ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Store size={20} className="text-emerald-400" /></div>
            <div className="flex-1">
              <h3 className="text-white font-medium text-sm">Vendeur {vendorTier === "premium" && <span className="text-emerald-400 text-[10px]">✓ Premium</span>}</h3>
              <ul className="mt-3 space-y-1.5">
                {[
                  { free: "1 facility, 5 produits", prem: "Facilities & produits illimités" },
                  { free: "Fonctions essentielles", prem: "Fonctions avancées vendeur" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check size={10} className={`mt-0.5 shrink-0 ${vendorTier === "premium" ? "text-emerald-400" : "text-white/20"}`} />
                    <span className={vendorTier === "premium" ? "text-white/60" : "text-white/30"}>{vendorTier === "premium" ? item.prem : item.free}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {vendorTier !== "premium" && (
            <button type="button" disabled
              className="w-full mt-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-medium cursor-not-allowed"
            >
              Bientôt disponible
            </button>
          )}
        </div>

        {/* Delivery subscription */}
        <div className={`rounded-2xl border p-5 mb-4 ${deliveryTier === "premium" ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Truck size={20} className="text-emerald-400" /></div>
            <div className="flex-1">
              <h3 className="text-white font-medium text-sm">Livreur {deliveryTier === "premium" && <span className="text-emerald-400 text-[10px]">✓ Premium</span>}</h3>
              <ul className="mt-3 space-y-1.5">
                {[
                  { free: "3 livraisons/jour, rayon uniquement", prem: "Livraisons illimitées" },
                  { free: "Pas de temps réel", prem: "Mode trajet multi-stops + temps réel" },
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <Check size={10} className={`mt-0.5 shrink-0 ${deliveryTier === "premium" ? "text-emerald-400" : "text-white/20"}`} />
                    <span className={deliveryTier === "premium" ? "text-white/60" : "text-white/30"}>{deliveryTier === "premium" ? item.prem : item.free}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {deliveryTier !== "premium" && (
            <button type="button" disabled
              className="w-full mt-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white/40 text-sm font-medium cursor-not-allowed"
            >
              Bientôt disponible
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
