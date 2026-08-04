import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function FedaPayWidget({
  amount,
  public_key,
  onComplete,
  onCancel,
}) {
  const [FedaCheckoutButton, setFedaCheckoutButton] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Load FedaPay checkout script if not already loaded
    if (!document.querySelector('script[src*="cdn.fedapay.com/checkout.js"]')) {
      const script = document.createElement("script");
      script.src = "https://cdn.fedapay.com/checkout.js?v=1.1.7";
      script.async = true;
      script.onload = () => {
        import("fedapay-reactjs").then((mod) => {
          setFedaCheckoutButton(() => mod.FedaCheckoutButton);
          setLoading(false);
        });
      };
      document.body.appendChild(script);
    } else {
      import("fedapay-reactjs").then((mod) => {
        setFedaCheckoutButton(() => mod.FedaCheckoutButton);
        setLoading(false);
      });
    }
  }, []);

  if (loading || typeof window === "undefined" || !window.FedaPay) {
    return (
      <button
        disabled
        className="w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium opacity-60 cursor-wait flex items-center justify-center gap-2"
      >
        <Loader2 size={12} className="animate-spin" />
        Chargement...
      </button>
    );
  }

  const options = {
    public_key,
    transaction: {
      amount: amount, // Amount in FCFA (no conversion needed)
      description: `Recharge portefeuille Omni - ${amount} FCFA`,
    },
    currency: {
      iso: "XOF", // FCFA Franc
    },
    button: {
      class: "w-full py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2",
      text: `Payer ${amount?.toLocaleString()} FCFA via Mobile Money`,
    },
    onComplete(resp) {
      const FedaPay = window.FedaPay;
      if (FedaPay && resp.reason === FedaPay.DIALOG_DISMISSED) {
        onCancel?.();
        return;
      }
      if (resp.transaction?.id) {
        onComplete(String(resp.transaction.id));
      }
    },
  };

  return <FedaCheckoutButton options={options} />;
}
