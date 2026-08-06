"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Store, Truck, Crown, Check, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function SubscriptionsPage() {
  const navigate = useNavigate();
  const [vendorTier, setVendorTier] = useState("free");
  const [deliveryTier, setDeliveryTier] = useState("free");
  const [balance, setBalance] = useState(0);
  const [sending, setSending] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      const { authFetch } = await import("@/lib/auth-client");
      try {
        const r = await authFetch("/api/auth/session");
        const data = await r.json();
        if (!data?.user) { navigate("/auth"); return; }
        loadData();
      } catch {
        navigate("/auth");
      }
    };
    checkSession();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, walRes] = await Promise.all([
        fetch("/api/subscriptions/status"),
        fetch("/api/wallet/balance"),
      ]);
      if (subRes.ok) {
        const sd = await subRes.json();
        setVendorTier(sd.vendorTier || "free");
        setDeliveryTier(sd.deliveryTier || "free");
      }
      if (walRes.ok) {
        const wd = await walRes.json();
        setBalance(wd.balance || 0);
      }
    } catch {} finally { setLoading(false); }
  };

  const upgrade = async (type) => {
    setSending(type);
    try {
      const fee = type === "vendor" ? 5000 : 1000;
      if (balance < fee) { toast("Solde insuffisant — recharge d'abord"); setSending(null); return; }
      const res = await fetch("/api/subscriptions/upgrade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, tier: "premium" }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast(`Abonnement ${type === "vendor" ? "vendeur" : "livreur"} activé !`);
      loadData();
    } catch (err) { toast(err.message || "Erreur"); } finally { setSending(null); }
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

        {/* Balance reminder */}
        <Link to="/wallet" className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 mb-6 hover:bg-emerald-500/10 transition-all">
          <Wallet size={14} className="text-emerald-400" />
          <span className="text-xs text-emerald-400/70">Solde : <strong className="text-emerald-400">{balance.toLocaleString()} FCFA</strong></span>
          <span className="text-[10px] text-emerald-400/40 ml-auto">Recharger →</span>
        </Link>

        {/* Vendor subscription */}
        <div className={`rounded-2xl border p-5 mb-4 ${vendorTier === "premium" ? "border-emerald-500/30 bg-emerald-500/5" : "border-white/10 bg-white/[0.02]"}`}>
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0"><Store size={20} className="text-emerald-400" /></div>
            <div className="flex-1">
              <h3 className="text-white font-medium text-sm">Vendeur {vendorTier === "premium" && <span className="text-emerald-400 text-[10px]">✓ Premium</span>}</h3>
              <ul className="mt-3 space-y-1.5">
                {[
                  { free: "1 facility, 5 produits", prem: "Facilities & produits illimités" },
                  { free: "Cash uniquement", prem: "Cash + escrow (encaissement wallet)" },
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
            <button onClick={() => upgrade("vendor")} disabled={sending === "vendor"}
              className="w-full mt-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {sending === "vendor" ? <Loader2 size={14} className="animate-spin" /> : null}
              5 000 FCFA / mois
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
            <button onClick={() => upgrade("delivery")} disabled={sending === "delivery"}
              className="w-full mt-4 py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {sending === "delivery" ? <Loader2 size={14} className="animate-spin" /> : null}
              1 000 FCFA / mois
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
