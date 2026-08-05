"use client";

import { useState } from "react";
import { Heart } from "lucide-react";

export default function FavoriteButton({ vendorId, initialFavorited = false }) {
  const [favorited, setFavorited] = useState(initialFavorited);
  const [loading, setLoading] = useState(false);

  const toggleFavorite = async () => {
    try {
      const authRes = await fetch("/api/auth/session", { cache: "no-store" });
      const authData = await authRes.json();
      if (!authData?.user) {
        window.location.href = "/auth";
        return;
      }
    } catch {
      window.location.href = "/auth";
      return;
    }

    setLoading(true);

    try {
      if (favorited) {
        await fetch(`/api/favorites?vendorId=${vendorId}`, {
          method: "DELETE"
        });
      } else {
        await fetch("/api/favorites", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ vendorId })
        });
      }
      setFavorited(!favorited);
    } catch (err) {
      console.error("Favorite error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggleFavorite}
      disabled={loading}
      className={`p-2 rounded-full transition-colors ${
        favorited 
          ? "text-red-500 bg-red-50 hover:bg-red-500/[0.12]" 
          : "text-white/40 hover:text-red-500 hover:bg-red-500/[0.06]"
      }`}
    >
      <Heart 
        size={24} 
        fill={favorited ? "currentColor" : "none"} 
      />
    </button>
  );
}
