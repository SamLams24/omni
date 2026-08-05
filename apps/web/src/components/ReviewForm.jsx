import { useState } from "react";
import { Star, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function ReviewForm({ facilityId, onSubmitted }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (rating === 0) return;
    setSending(true);
    try {
      const authRes = await fetch("/api/auth/session", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData?.user) { toast("Connecte-toi d'abord"); return; }

      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, rating, comment }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast("Avis envoyé !");
      onSubmitted?.();
      setRating(0);
      setComment("");
    } catch (err) {
      toast(err.message || "Erreur");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setRating(star)}
            className="transition-all hover:scale-110"
          >
            <Star
              size={20}
              className={`${star <= (hover || rating) ? "text-amber-400 fill-amber-400" : "text-white/20"} transition-colors`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Ton avis (optionnel)..."
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white/70 placeholder-white/30 outline-none resize-none h-20"
      />
      <button
        onClick={submit}
        disabled={rating === 0 || sending}
        className="w-full py-2 rounded-lg bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all disabled:opacity-30"
      >
        {sending ? <Loader2 size={14} className="animate-spin mx-auto" /> : "Envoyer l'avis"}
      </button>
    </div>
  );
}
