"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Heart, MapPin, Loader2, LogOut, ArrowLeft } from "lucide-react";
import { getSession, signOut } from "@/lib/auth-client";

export default function UserProfilePage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const session = await getSession();
        if (!session.user) {
          localStorage.removeItem("omni_user");
          navigate("/auth");
          return;
        }

        setUser(session.user);
        const response = await fetch("/api/favorites");
        const data = await response.json();
        setFavorites(data.favorites || []);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [navigate]);

  const handleSignOut = async () => {
    await signOut();
    localStorage.removeItem("omni_user");
    navigate("/");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#08080f]">
        <Loader2 className="animate-spin text-emerald-500" size={48} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f]">
      <div className="max-w-2xl mx-auto px-6 py-8">
        <button
          onClick={() => navigate("/map")}
          className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors mb-6"
        >
          <ArrowLeft size={18} />
          <span className="text-sm">Retour à la carte</span>
        </button>
        <div className="bg-[#0e0e18] rounded-xl border border-white/[0.06] p-6 mb-6">
          <h1 className="text-2xl font-bold text-white/90 mb-4">Mon Profil</h1>
          <div className="space-y-3">
            <div>
              <span className="text-white/40">Email:</span>
              <span className="ml-2 text-white/70">{user?.email}</span>
            </div>
            <div>
              <span className="text-white/40">Nom:</span>
              <span className="ml-2 text-white/70">{user?.name || "Non défini"}</span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-4 flex items-center gap-2 text-red-400/60 hover:text-red-400 transition-colors"
          >
            <LogOut size={18} />
            Déconnexion
          </button>
        </div>

        <div className="bg-[#0e0e18] rounded-xl border border-white/[0.06] p-6">
          <h2 className="text-xl font-bold text-white/90 mb-4 flex items-center gap-2">
            <Heart className="text-red-500" size={20} />
            Mes boutiques favorites
          </h2>

          {favorites.length === 0 ? (
            <p className="text-white/40 text-center py-8">
              Aucune boutique favorite. Explorez la carte pour en trouver!
            </p>
          ) : (
            <div className="space-y-4">
              {favorites.map((vendor) => (
                <div
                  key={vendor.id}
                  className="border border-white/[0.06] rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h3 className="font-semibold text-white/80">{vendor.name}</h3>
                    <p className="text-sm text-white/40">{vendor.category}</p>
                  </div>
                  <button
                    onClick={() => navigate(`/map?vendor=${vendor.id}`)}
                    className="text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <MapPin size={20} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
