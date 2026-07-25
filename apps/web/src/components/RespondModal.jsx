import { useState } from "react";
import { X, Loader2, Check, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

export default function RespondModal({ cart, onClose, onDone }) {
  const [items, setItems] = useState(
    (cart.items || []).map((item) => ({
      requestId: item.id,
      productName: item.product_name,
      quantity: item.quantity_requested,
      status: "confirmed",
      quantityConfirmed: item.quantity_requested,
    }))
  );
  const [sending, setSending] = useState(false);

  const toggleItem = (idx) => {
    const updated = [...items];
    if (updated[idx].status === "confirmed") {
      updated[idx].status = "denied";
      updated[idx].quantityConfirmed = 0;
    } else {
      updated[idx].status = "confirmed";
      updated[idx].quantityConfirmed = updated[idx].quantity;
    }
    setItems(updated);
  };

  const updateQty = (idx, val) => {
    const updated = [...items];
    const qty = Math.max(0, parseInt(val) || 0);
    updated[idx].quantityConfirmed = qty;
    updated[idx].status = qty > 0 ? "confirmed" : "denied";
    setItems(updated);
  };

  const confirmAll = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/cart/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cartId: cart.id, confirmAll: true }),
      });
      if (!res.ok) throw new Error();
      toast("Demande confirmée !");
      onDone();
    } catch { toast("Erreur"); } finally { setSending(false); }
  };

  const sendResponse = async () => {
    setSending(true);
    try {
      const res = await fetch("/api/cart/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cartId: cart.id,
          items: items.map(i => ({
            requestId: i.requestId,
            status: i.status,
            quantityConfirmed: i.quantityConfirmed,
          })),
        }),
      });
      if (!res.ok) throw new Error();
      toast("Réponse envoyée !");
      onDone();
    } catch { toast("Erreur"); } finally { setSending(false); }
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-zinc-900 rounded-2xl border border-white/10 w-full max-w-md max-h-[80vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <div className="flex items-center gap-2">
              <ShoppingBag size={16} className="text-emerald-400" />
              <h2 className="text-white font-medium text-sm">{cart.facility_name}</h2>
            </div>
            <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
              <X size={14} className="text-white/50" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            <p className="text-white/30 text-xs">Client : {cart.buyer_name} · {cart.buyer_phone}</p>

            {items.map((item, idx) => (
              <div key={item.requestId} className="flex items-center justify-between bg-white/[0.02] rounded-xl border border-white/[0.06] p-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => toggleItem(idx)}
                    className={`w-5 h-5 rounded border flex items-center justify-center transition-all shrink-0 ${
                      item.status === "confirmed"
                        ? "bg-emerald-500 border-emerald-500"
                        : "bg-white/5 border-white/10"
                    }`}
                  >
                    {item.status === "confirmed" && <Check size={10} className="text-black" />}
                  </button>
                  <div className="min-w-0">
                    <p className={`text-sm truncate ${item.status === "confirmed" ? "text-white/70" : "text-white/30 line-through"}`}>{item.productName}</p>
                    <p className="text-[10px] text-white/20">Demandé: {item.quantity}</p>
                  </div>
                </div>
                {item.status === "confirmed" && (
                  <div className="flex items-center gap-1 shrink-0 ml-3">
                    <input
                      type="number"
                      value={item.quantityConfirmed}
                      onChange={(e) => updateQty(idx, e.target.value)}
                      min="0"
                      max={item.quantity}
                      className="w-14 bg-white/5 border border-white/10 rounded-lg px-2 py-1 text-xs text-white/70 text-center outline-none"
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="p-5 border-t border-white/10 space-y-2">
            <button onClick={confirmAll} disabled={sending}
              className="w-full py-2.5 rounded-lg bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : null}
              Confirmer tout
            </button>
            <button onClick={sendResponse} disabled={sending}
              className="w-full py-2.5 rounded-lg bg-white/5 border border-white/10 text-white/70 text-sm font-medium hover:bg-white/10 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : null}
              Envoyer la réponse personnalisée
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
