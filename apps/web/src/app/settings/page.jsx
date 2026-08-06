"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, User, MapPin, Trash2, ChevronRight } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export default function SettingsPage() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const [form, setForm] = useState({ name: "", phone: "" });
  const [location, setLocation] = useState(null);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const { authFetch } = await import("@/lib/auth-client");
        const res = await authFetch("/api/auth/session");
        const data = await res.json();
        if (!data?.user) {
          navigate("/auth");
          return;
        }
        setUser(data.user);

      const res = await fetch("/api/user/profile");
      const data = await res.json();
      if (data.user) {
        setForm({ name: data.user.name || "", phone: data.user.phone || "" });
        if (data.user.lat && data.user.lon) {
          setLocation({ lat: data.user.lat, lon: data.user.lon });
        }
      }
      setLoading(false);
    };
    loadProfile();
  }, [navigate]);

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setError("Impossible de détecter ta position")
      );
    } else {
      setError("Géolocalisation non supportée");
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const res = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          ...(location ? { lat: location.lat, lon: location.lon } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Profil mis à jour");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/user/account", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      await signOut();
      localStorage.removeItem("omni_user");
      navigate("/");
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f]">
      <div className="max-w-lg mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ChevronRight size={14} className="text-white/50 rotate-180" />
          </button>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center">
            <User size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="font-space-grotesk text-xl font-bold text-white">Paramètres</h1>
            <p className="font-dm-sans text-sm text-zinc-500">Ton profil et préférences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Profile form */}
          <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-5">
            {/* Email (read-only) */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Email</label>
              <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3">
                <p className="text-zinc-500 text-sm">{user?.email}</p>
              </div>
            </div>

            {/* Name */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Nom</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ton nom"
                  className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                />
              </div>
            </div>

            {/* Phone */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Téléphone</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="+228 XX XX XX XX"
                  className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Localisation</label>
              <button
                type="button"
                onClick={detectLocation}
                className="flex items-center gap-3 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all font-dm-sans"
              >
                <MapPin size={16} className="text-emerald-400 shrink-0" />
                {location ? `${location.lat.toFixed(4)}, ${location.lon.toFixed(4)}` : "Détecter ma position"}
              </button>
            </div>

            {error && (
              <div className="px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/5">
                <p className="font-dm-sans text-sm text-red-400">{error}</p>
              </div>
            )}

            {success && (
              <div className="px-4 py-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                <p className="font-dm-sans text-sm text-emerald-400">{success}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all disabled:opacity-50"
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>

          {/* Delete account */}
          <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-6">
            <h2 className="font-space-grotesk text-base font-bold text-red-400 mb-2">Zone dangereuse</h2>
            <p className="font-dm-sans text-sm text-zinc-500 mb-4">
              Supprime ton compte et toutes tes données. Action irréversible.
            </p>
            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/5 text-red-400 text-sm font-dm-sans transition-all"
              >
                <Trash2 size={16} />
                Supprimer mon compte
              </button>
            ) : (
              <div>
                <p className="font-dm-sans text-sm text-red-400/80 mb-3">
                  Es-tu sûr ? Cette action est irréversible.
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm transition-all disabled:opacity-50"
                  >
                    {deleting ? "..." : "Confirmer la suppression"}
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 text-sm font-dm-sans transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
