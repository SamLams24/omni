"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Settings, Loader2, Plus, Trash2, Bike, Footprints, Car, Smartphone, Truck, Check } from "lucide-react";
import { toast } from "sonner";

const VEHICLE_ICONS = { pedestrian: Footprints, bicycle: Bike, motorcycle: Smartphone, car: Car, truck: Truck };
const VEHICLE_LABELS = { pedestrian: "À pied", bicycle: "Vélo", motorcycle: "Moto", car: "Voiture", truck: "Camion" };

export default function DeliverySettings() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [form, setForm] = useState({ fullName: "", phone: "" });
  const [prefs, setPrefs] = useState(() => {
    try {
      const raw = localStorage.getItem("delivery_prefs");
      return raw ? JSON.parse(raw) : { mode: "rayon", maxRadius: 5, deviationKm: 2 };
    } catch { return { mode: "rayon", maxRadius: 5, deviationKm: 2 }; }
  });

  const savePrefs = (newPrefs) => {
    setPrefs(newPrefs);
    localStorage.setItem("delivery_prefs", JSON.stringify(newPrefs));
  };

  const loadProfile = async () => {
    try {
      const res = await fetch("/api/delivery/profile");
      if (res.ok) {
        const data = await res.json();
        setProfile(data.profile);
        setVehicles(data.profile?.vehicles || []);
        setForm({ fullName: data.profile?.full_name || "", phone: data.profile?.phone || "" });
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadProfile(); }, []);

  const handleSave = async () => {
    if (!form.fullName.trim() || !form.phone.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/delivery/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error();
      toast("Profil mis à jour");
    } catch { toast("Erreur"); } finally { setSaving(false); }
  };

  const addVehicle = async (type) => {
    setAdding(true);
    try {
      const res = await fetch("/api/delivery/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      });
      if (!res.ok) throw new Error();
      toast("Véhicule ajouté");
      setShowAdd(false);
      loadProfile();
    } catch { toast("Erreur"); } finally { setAdding(false); }
  };

  const removeVehicle = async (vehicleId) => {
    try {
      const res = await fetch(`/api/delivery/vehicles/${vehicleId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast("Véhicule supprimé");
      loadProfile();
    } catch { toast("Erreur"); }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  const usedTypes = new Set(vehicles.map((v) => v.type));
  const availableTypes = Object.keys(VEHICLE_LABELS).filter((t) => !usedTypes.has(t));

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => navigate(-1)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ArrowLeft size={14} className="text-white/50" />
          </button>
          <Settings size={20} className="text-emerald-400" />
          <div>
            <h1 className="text-lg font-medium">Paramètres livreur</h1>
            <p className="text-white/30 text-sm">Ton profil et moyens de livraison</p>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <h2 className="text-sm text-white/60 font-medium">Informations</h2>
            <input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Nom complet" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/30 outline-none focus:border-emerald-500/50 transition-all" />
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Téléphone" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/30 outline-none focus:border-emerald-500/50 transition-all" />
            <button onClick={handleSave} disabled={saving}
              className="w-full py-2.5 rounded-xl bg-emerald-500 text-black text-sm font-medium hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : null}
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm text-white/60 font-medium">Moyens de livraison</h2>
              {availableTypes.length > 0 && (
                <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-emerald-500/10 text-emerald-400 text-xs hover:bg-emerald-500/20 transition-all">
                  <Plus size={12} /> Ajouter
                </button>
              )}
            </div>

            {vehicles.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-6">Aucun véhicule</p>
            ) : (
              <div className="space-y-2">
                {vehicles.map((v) => {
                  const Icon = VEHICLE_ICONS[v.type] || Truck;
                  return (
                    <div key={v.id} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${v.is_active ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.02] border-white/5"}`}>
                      <Icon size={18} className={v.is_active ? "text-emerald-400" : "text-white/30"} />
                      <span className="flex-1 text-sm text-white/70">{VEHICLE_LABELS[v.type] || v.type}</span>
                      {v.is_active && <span className="text-[10px] text-emerald-400 flex items-center gap-1"><Check size={10} /> Actif</span>}
                      <button onClick={() => removeVehicle(v.id)} className="text-red-400/40 hover:text-red-400 p-1 transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {showAdd && availableTypes.length > 0 && (
              <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[10px] text-white/30 mb-2 uppercase tracking-widest">Ajouter un moyen</p>
                <div className="space-y-1">
                  {availableTypes.map((type) => {
                    const Icon = VEHICLE_ICONS[type] || Truck;
                    return (
                      <button key={type} onClick={() => addVehicle(type)} disabled={adding}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 text-white/50 hover:text-white/70 transition-all text-sm"
                      >
                        <Icon size={16} />
                        {VEHICLE_LABELS[type]}
                      </button>
                    );
                  })}
          </div>

          {/* Delivery Preferences */}
          <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 space-y-4">
            <h2 className="text-sm text-white/60 font-medium">Préférences de livraison</h2>
            <div>
              <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 block">Mode</label>
              <div className="flex gap-2">
                {["rayon", "route"].map((m) => (
                  <button key={m} onClick={() => savePrefs({ ...prefs, mode: m })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      prefs.mode === m
                        ? "bg-emerald-500 text-black"
                        : "bg-white/5 text-white/40 hover:bg-white/10"
                    }`}
                  >
                    {m === "rayon" ? "🎯 Rayon" : "🗺️ Trajet"}
                  </button>
                ))}
              </div>
            </div>
            {prefs.mode === "rayon" ? (
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex justify-between">
                  <span>Rayon max</span>
                  <span className="text-emerald-400/60">{prefs.maxRadius} km</span>
                </label>
                <input type="range" min="1" max="20" step="0.5" value={prefs.maxRadius}
                  onChange={(e) => savePrefs({ ...prefs, maxRadius: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1"
                />
              </div>
            ) : (
              <div>
                <label className="text-[10px] text-white/30 uppercase tracking-widest mb-2 flex justify-between">
                  <span>Déviation max</span>
                  <span className="text-emerald-400/60">{prefs.deviationKm} km</span>
                </label>
                <input type="range" min="0" max="10" step="0.5" value={prefs.deviationKm}
                  onChange={(e) => savePrefs({ ...prefs, deviationKm: parseFloat(e.target.value) })}
                  className="w-full accent-emerald-500 h-1"
                />
              </div>
            )}
          </div>
        </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
