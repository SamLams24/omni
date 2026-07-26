import { useState } from "react";
import { X, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export default function DepositModal({ isOpen, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleDeposit = async (m) => {
    setMethod(m);
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount), method: m }),
      });
      if (res.ok) {
        toast(`Dépôt de ${amount} FCFA effectué (${m})`);
        onDone?.();
        onClose();
      } else {
        toast("Erreur lors du dépôt");
      }
    } catch {
      toast("Erreur");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Déposer de l'argent</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white/60"><X size={16} /></button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 mb-4">
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="Montant (FCFA)" min="0"
            className="w-full bg-transparent outline-none text-white text-sm placeholder:text-white/20"
          />
        </div>
        <div className="space-y-2">
          <button onClick={() => handleDeposit("mobile_money")} disabled={!amount || loading}
            className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading && method === "mobile_money" ? <Loader2 size={12} className="animate-spin" /> : null}
            Mobile Money
          </button>
          <button onClick={() => handleDeposit("crypto")} disabled={!amount || loading}
            className="w-full py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {loading && method === "crypto" ? <Loader2 size={12} className="animate-spin" /> : null}
            Crypto (USDT)
          </button>
        </div>
      </div>
    </div>
  );
}
