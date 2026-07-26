"use client";

import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { ArrowLeft, Wallet, Plus, ArrowUpRight, ArrowDownRight, Clock, Loader2, Minus, Smartphone, Bitcoin } from "lucide-react";
import { toast } from "sonner";
import DepositModal from "@/components/DepositModal";

export default function WalletPage() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showDeposit, setShowDeposit] = useState(false);
  const [showWithdraw, setShowWithdraw] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const user = localStorage.getItem("omni_user");
    if (!user) { navigate("/auth"); return; }
    loadWallet();
  }, []);

  const loadWallet = async () => {
    try {
      const res = await fetch("/api/wallet/balance");
      if (res.ok) {
        const data = await res.json();
        setBalance(data.balance);
        setTransactions(data.recent_transactions || []);
      }
    } catch {} finally {
      setLoading(false);
    }
  };

  const txIcon = (type) => {
    switch (type) {
      case 'deposit': return <ArrowDownRight size={12} className="text-emerald-400" />;
      case 'withdrawal': return <ArrowUpRight size={12} className="text-red-400" />;
      case 'escrow_hold': return <Clock size={12} className="text-amber-400" />;
      case 'escrow_release': return <ArrowDownRight size={12} className="text-emerald-400" />;
      case 'escrow_refund': return <ArrowDownRight size={12} className="text-blue-400" />;
      case 'delivery_payment': return <ArrowDownRight size={12} className="text-emerald-400" />;
      default: return <Clock size={12} className="text-white/20" />;
    }
  };

  const txLabel = (type) => ({
    deposit: 'Dépôt', withdrawal: 'Retrait', escrow_hold: 'Mise en escrow',
    escrow_release: 'Libéré', escrow_refund: 'Remboursé', fee: 'Frais',
    delivery_payment: 'Paiement livraison',
  }[type] || type);

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
            <Wallet size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-medium">Portefeuille</h1>
            <p className="text-white/30 text-sm">Gère ton solde</p>
          </div>
        </div>

        {/* Balance card */}
        <div className="bg-gradient-to-br from-emerald-500/10 to-teal-500/5 rounded-2xl border border-emerald-500/20 p-6 mb-6">
          <p className="text-xs text-emerald-400/60 font-medium mb-2">Solde disponible</p>
          <p className="text-3xl font-bold text-white">{balance?.toLocaleString() || 0} <span className="text-sm font-normal text-emerald-400/60">FCFA</span></p>
          <div className="flex gap-2 mt-4">
            <button onClick={() => setShowDeposit(!showDeposit)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500 text-black text-xs font-medium hover:bg-emerald-400 transition-all"
            >
              <Plus size={12} />
              Recharger
            </button>
            <button onClick={() => setShowWithdraw(!showWithdraw)}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-white/50 text-xs font-medium hover:bg-white/10 transition-all"
            >
              <Minus size={12} />
              Retirer
            </button>
          </div>
        </div>

        {/* Deposit modal */}
        <DepositModal isOpen={showDeposit} onClose={() => setShowDeposit(false)} onDone={loadWallet} />

        {/* Withdraw form */}
        {showWithdraw && (
          <div className="bg-white/[0.02] rounded-xl border border-white/10 p-4 mb-6 space-y-3">
            <input type="number" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)}
              placeholder="Montant (FCFA)" className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5 text-sm text-white/70 placeholder-white/30 outline-none" />
            <div className="flex gap-2">
              <button onClick={async () => {
                const amount = parseFloat(withdrawAmount);
                if (!amount || amount <= 0) { toast("Montant invalide"); return; }
                setSending(true);
                try {
                  const res = await fetch("/api/wallet/withdraw", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount, method: "mobile_money" }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
                  toast(`${amount.toLocaleString()} FCFA retirés !`);
                  setShowWithdraw(false);
                  setWithdrawAmount("");
                  loadWallet();
                } catch (err) { toast(err.message || "Erreur"); } finally { setSending(false); }
              }} disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all disabled:opacity-30"
              >{sending ? <Loader2 size={12} className="animate-spin" /> : <Smartphone size={14} />} Mobile Money</button>
              <button onClick={async () => {
                const amount = parseFloat(withdrawAmount);
                if (!amount || amount <= 0) { toast("Montant invalide"); return; }
                setSending(true);
                try {
                  const res = await fetch("/api/wallet/withdraw", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ amount, method: "crypto" }),
                  });
                  if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
                  toast(`${amount.toLocaleString()} FCFA retirés !`);
                  setShowWithdraw(false);
                  setWithdrawAmount("");
                  loadWallet();
                } catch (err) { toast(err.message || "Erreur"); } finally { setSending(false); }
              }} disabled={sending}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-medium hover:bg-purple-500/20 transition-all disabled:opacity-30"
              >{sending ? <Loader2 size={12} className="animate-spin" /> : <Bitcoin size={14} />} Crypto</button>
            </div>
          </div>
        )}

        {/* Transactions */}
        <h2 className="text-sm text-white/60 font-medium mb-3">Dernières transactions</h2>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
              <Clock size={24} className="text-white/30" />
            </div>
            <p className="text-white/30 text-sm">Aucune transaction</p>
            <p className="text-white/10 text-xs mt-1">Les transactions apparaîtront ici après avoir rechargé</p>
          </div>
        ) : (
          <div className="space-y-2">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between bg-white/[0.02] rounded-xl border border-white/[0.06] px-4 py-3 transition-all hover:bg-white/[0.04]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">{txIcon(tx.type)}</div>
                  <div>
                    <p className="text-white/70 text-xs font-medium">{txLabel(tx.type)}</p>
                    <p className="text-white/20 text-[10px]">{new Date(tx.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</p>
                  </div>
                </div>
                <span className={`text-sm font-medium ${tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'escrow_refund' || tx.type === 'delivery_payment' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {tx.type === 'deposit' || tx.type === 'escrow_release' || tx.type === 'escrow_refund' || tx.type === 'delivery_payment' ? '+' : '-'}{tx.amount?.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
