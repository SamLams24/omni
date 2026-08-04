import { useState } from "react";
import { X, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";
import FedaPayWidget from "./FedaPayWidget";

const FEDAPAY_PUBLIC_KEY = import.meta.env.VITE_FEDAPAY_PUBLIC_KEY;

export default function DepositModal({ isOpen, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleFedaPayComplete = async (transactionId) => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/verify-fedapay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId, amount: parseFloat(amount) }),
      });
      const data = await res.json();
      if (data.ok) {
        setSuccess(true);
        toast(`Dépôt de ${parseFloat(amount).toLocaleString()} FCFA effectué !`);
        setTimeout(() => {
          onDone?.();
          onClose();
          setSuccess(false);
          setAmount("");
        }, 1500);
      } else {
        toast(data.error || "Erreur lors de la vérification du paiement");
      }
    } catch {
      toast("Erreur lors de la vérification du paiement");
    } finally {
      setLoading(false);
    }
  };

  const handleFedaPayCancel = () => {
    // User dismissed the dialog — no action needed
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check size={24} className="text-emerald-400" />
          </div>
          <h3 className="text-sm font-medium text-white mb-2">Paiement réussi !</h3>
          <p className="text-white/40 text-xs">{parseFloat(amount).toLocaleString()} FCFA ajoutés à votre portefeuille</p>
        </div>
      </div>
    );
  }

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
          {amount && parseFloat(amount) > 0 && FEDAPAY_PUBLIC_KEY ? (
            <FedaPayWidget
              amount={parseFloat(amount)}
              public_key={FEDAPAY_PUBLIC_KEY}
              onComplete={handleFedaPayComplete}
              onCancel={handleFedaPayCancel}
            />
          ) : (
            <button disabled={!amount || loading}
              className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium opacity-30 flex items-center justify-center gap-2"
            >
              Mobile Money
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
