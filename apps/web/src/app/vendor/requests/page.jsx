"use client";

import { useState, useEffect } from "react";
import {
  CheckCircle,
  XCircle,
  Loader2,
  MessageCircle,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import useUser from "@/utils/useUser";
import ChatModal from "@/components/ChatModal";

export default function VendorRequestsPage() {
  const { data: user, loading: userLoading } = useUser();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (user && !userLoading) {
      loadRequests();
    }
  }, [user, userLoading]);

  const loadRequests = async () => {
    try {
      const response = await fetch("/api/vendors/requests");
      if (!response.ok) throw new Error("Failed to load requests");

      const data = await response.json();
      setRequests(data.requests || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRespond = async (requestId, status, quantityConfirmed = null) => {
    setLoading(true);
    try {
      const response = await fetch("/api/availability/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          status,
          quantityConfirmed,
        }),
      });

      if (!response.ok) throw new Error("Failed to respond");

      await loadRequests();
    } catch (err) {
      console.error(err);
      toast("Erreur lors de la réponse");
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-space-grotesk text-2xl md:text-3xl font-bold text-white">
          Demandes de disponibilité
        </h1>
        <p className="font-dm-sans text-sm text-zinc-400 mt-1">
          {requests.length} demande{requests.length > 1 ? "s" : ""}
        </p>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Filters */}
        <div className="flex gap-2">
          {[
            { key: "all", label: "Toutes" },
            { key: "pending", label: "En attente" },
            { key: "confirmed", label: "Confirmées" },
            { key: "denied", label: "Refusées" },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-xl text-sm font-dm-sans transition-all ${
                filter === key
                  ? "bg-emerald-500/10 text-emerald-400 font-medium"
                  : "text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Requests List */}
        {filteredRequests.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-12 text-center">
            <ClipboardList size={40} className="mx-auto mb-4 text-zinc-600" />
            <p className="font-dm-sans text-sm text-zinc-500">Aucune demande pour le moment</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredRequests.map((req) => (
              <div
                key={req.id}
                className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition-all hover:bg-zinc-900/80"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-dm-sans font-bold text-zinc-200 text-lg mb-1">
                      {req.product_name}
                    </h3>
                    <p className="font-dm-sans text-sm text-zinc-400">
                      Quantité demandée: {req.quantity_requested}{" "}
                      {req.product_unit}
                    </p>
                    <p className="font-dm-sans text-xs text-zinc-500 mt-1">
                      {new Date(req.created_at).toLocaleString("fr-FR")}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-dm-sans font-medium ${
                      req.status === "pending"
                        ? "bg-yellow-500/10 text-yellow-400"
                        : req.status === "confirmed"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-red-500/10 text-red-400"
                    }`}
                  >
                    {req.status === "pending"
                      ? "En attente"
                      : req.status === "confirmed"
                        ? "Confirmé"
                        : "Refusé"}
                  </span>
                </div>

                {req.status === "pending" && (
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        handleRespond(
                          req.id,
                          "confirmed",
                          req.quantity_requested,
                        )
                      }
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
                    >
                      <CheckCircle size={16} />
                      Confirmer
                    </button>
                    <button
                      onClick={() => handleRespond(req.id, "denied")}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-400 font-semibold text-sm transition-all"
                    >
                      <XCircle size={16} />
                      Refuser
                    </button>
                    <button
                      onClick={() => setSelectedRequest(req)}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm font-dm-sans transition-all"
                    >
                      <MessageCircle size={16} />
                      Message
                    </button>
                  </div>
                )}

                {req.status !== "pending" && req.quantity_confirmed && (
                  <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
                    <p className="font-dm-sans text-sm text-emerald-400">
                      Quantité confirmée: {req.quantity_confirmed}{" "}
                      {req.product_unit}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedRequest && (
        <ChatModal
          requestId={selectedRequest.id}
          vendorName="Client"
          onClose={() => setSelectedRequest(null)}
        />
      )}
    </div>
  );
}
