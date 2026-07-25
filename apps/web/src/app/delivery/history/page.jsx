"use client";

import { useState, useEffect } from "react";
import { Loader2, Package, XCircle } from "lucide-react";

export default function DeliveryHistory() {
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/delivery/history");
        if (res.ok) {
          const data = await res.json();
          setDeliveries(data.deliveries || []);
        }
      } catch {} finally { setLoading(false); }
    };
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <h1 className="text-xl font-semibold text-white mb-6">Historique des livraisons</h1>

        {deliveries.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <Package size={24} className="text-white/30" />
            </div>
            <p className="text-white/30 text-sm">Aucune livraison terminée</p>
          </div>
        ) : (
          <div className="space-y-2">
            {deliveries.map((d) => (
              <div key={d.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <p className="text-white/70 text-sm">{d.facility_name || "Boutique"}</p>
                  <p className="text-white/20 text-xs mt-0.5">{d.dropoff_address || "—"}</p>
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-white/20">
                    <span>{d.distance_km ? `${d.distance_km} km` : "—"}</span>
                    <span>{d.delivery_fee ? `${d.delivery_fee} FCFA` : "—"}</span>
                    <span>{new Date(d.updated_at).toLocaleDateString("fr-FR")}</span>
                  </div>
                </div>
                <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                  d.status === "delivered"
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-red-500/10 text-red-400"
                }`}>
                  {d.status === "delivered" ? "Livré" : "Annulé"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
