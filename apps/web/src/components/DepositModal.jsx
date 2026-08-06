import { useEffect, useState } from "react";
import { X, Loader2, Check } from "lucide-react";
import toast from "react-hot-toast";

const PUSH_POLL_INTERVAL_MS = 3000;
const PUSH_FALLBACK_AFTER_MS = 45000;

export default function DepositModal({ isOpen, onClose, onDone }) {
  const [amount, setAmount] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [intent, setIntent] = useState(null);
  const [confirmedAmount, setConfirmedAmount] = useState(null);

  useEffect(() => {
    if (!isOpen || intent?.flow !== "hosted_checkout" || !intent.checkoutUrl) return;
    window.location.assign(intent.checkoutUrl);
  }, [intent, isOpen]);

  useEffect(() => {
    if (!isOpen || intent?.flow !== "mobile_money_push") return;

    let stopped = false;
    let approvedSeen = false;
    const startedAt = Date.now();
    let timer;

    const useHostedCheckout = () => {
      if (!stopped) {
        setIntent(current => current ? { ...current, flow: "hosted_checkout" } : current);
      }
    };

    const poll = async () => {
      if (stopped) return;
      if (!approvedSeen && Date.now() - startedAt >= PUSH_FALLBACK_AFTER_MS) {
        useHostedCheckout();
        return;
      }

      try {
        const response = await fetch(
          `/api/wallet/fedapay-status?transactionId=${encodeURIComponent(intent.transactionId)}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok) {
          useHostedCheckout();
          return;
        }
        if (data.paymentState === "approved") {
          approvedSeen = true;
          const settled = await handleFedaPayComplete(intent.transactionId);
          if (!settled && !stopped) {
            timer = window.setTimeout(poll, PUSH_POLL_INTERVAL_MS);
          }
          return;
        }
        if (data.paymentState === "failed") {
          useHostedCheckout();
          return;
        }
      } catch {
        useHostedCheckout();
        return;
      }

      timer = window.setTimeout(poll, PUSH_POLL_INTERVAL_MS);
    };

    timer = window.setTimeout(poll, PUSH_POLL_INTERVAL_MS);
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
  }, [intent?.flow, intent?.transactionId, isOpen]);

  const createDepositIntent = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isSafeInteger(parsedAmount) || parsedAmount <= 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsedAmount, phoneNumber }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        toast(data.error || "Impossible d'initialiser le paiement");
        return;
      }
      setIntent(data);
      if (data.flow === "mobile_money_push") {
        toast("Validez la demande Mobile Money reçue sur votre téléphone");
      }
    } catch {
      toast("Impossible d'initialiser le paiement");
    } finally {
      setLoading(false);
    }
  };

  const handleFedaPayComplete = async (transactionId) => {
    setLoading(true);
    try {
      const res = await fetch("/api/wallet/verify-fedapay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transactionId }),
      });
      const data = await res.json();
      if (data.ok) {
        setConfirmedAmount(data.amount);
        setSuccess(true);
        toast(`Dépôt de ${Number(data.amount).toLocaleString()} FCFA effectué !`);
        setTimeout(() => {
          onDone?.();
          onClose();
          setSuccess(false);
          setAmount("");
          setPhoneNumber("");
          setIntent(null);
          setConfirmedAmount(null);
        }, 1500);
        return true;
      } else {
        toast(data.error || "Erreur lors de la vérification du paiement");
      }
    } catch {
      toast("Erreur lors de la vérification du paiement");
    } finally {
      setLoading(false);
    }
    return false;
  };

  const handleClose = () => {
    setIntent(null);
    setLoading(false);
    onClose();
  };

  if (!isOpen) return null;

  if (success) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
        <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4 text-center" onClick={e => e.stopPropagation()}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-500/20 flex items-center justify-center">
            <Check size={24} className="text-emerald-400" />
          </div>
          <h3 className="text-sm font-medium text-white mb-2">Paiement réussi !</h3>
          <p className="text-white/40 text-xs">{Number(confirmedAmount).toLocaleString()} FCFA ajoutés à votre portefeuille</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={handleClose}>
      <div className="bg-neutral-900 border border-white/10 rounded-2xl p-6 w-full max-w-sm mx-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-white">Déposer de l'argent</h3>
          <button onClick={handleClose} className="text-white/30 hover:text-white/60"><X size={16} /></button>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 mb-4">
          <input type="number" value={amount} onChange={e => {
            setAmount(e.target.value);
            setIntent(null);
          }}
            placeholder="Montant (FCFA)" min="100" step="1" disabled={loading}
            className="w-full bg-transparent outline-none text-white text-sm placeholder:text-white/20"
          />
        </div>
        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 mb-2">
          <input type="tel" value={phoneNumber} onChange={e => {
            setPhoneNumber(e.target.value);
            setIntent(null);
          }}
            placeholder="Numéro Mobile Money (+228...)" disabled={loading}
            autoComplete="tel"
            className="w-full bg-transparent outline-none text-white text-sm placeholder:text-white/20"
          />
        </div>
        <p className="mb-4 text-[11px] leading-relaxed text-white/30">
          Omni tente d’abord le push Moov Money. En cas d’échec ou d’absence de réponse, la page sécurisée FedaPay s’ouvre automatiquement.
        </p>
        <div className="space-y-2">
          {intent?.flow === "mobile_money_push" ? (
            <div className="w-full py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-medium flex items-center justify-center gap-2">
              <Loader2 size={12} className="animate-spin" />
              Confirmez le paiement sur votre téléphone…
            </div>
          ) : (
            <button
              type="button"
              onClick={createDepositIntent}
              disabled={!amount || !phoneNumber || loading || Boolean(intent)}
              className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : null}
              Continuer avec Mobile Money
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
