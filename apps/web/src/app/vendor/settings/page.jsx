"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { Loader2, Store, MapPin, Trash2, Settings, ChevronRight, Plus, Globe, Power, PowerOff, Edit, X, Check } from "lucide-react";

export default function VendorSettingsPage() {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [editingFacility, setEditingFacility] = useState(null);
  const [savingFacility, setSavingFacility] = useState(false);
  const [facilityForm, setFacilityForm] = useState({
    name: "", category: "", type: "fixed", description: "", address: "",
  });

  const [form, setForm] = useState({
    name: "", category: "", description: "", phone: "", email: "",
    address: "", neighborhood: "",
  });
  const [location, setLocation] = useState(null);

  useEffect(() => {
    loadVendor();
  }, []);

  const loadVendor = async () => {
    try {
      const res = await fetch("/api/vendors/my-vendor");
      if (!res.ok) { setVendor(null); setLoading(false); return; }

      const data = await res.json();
      setVendor(data.vendor);
      if (data.vendor) {
        setForm({
          name: data.vendor.name || "",
          category: data.vendor.category || "",
          description: data.vendor.description || "",
          phone: data.vendor.phone || "",
          email: data.vendor.email || "",
          address: data.vendor.address || "",
          neighborhood: data.vendor.neighborhood || "",
        });
        if (data.vendor.lat && data.vendor.lon) {
          setLocation({ lat: data.vendor.lat, lon: data.vendor.lon });
        }
      }
    } catch (err) {
      console.error(err);
      setVendor(null);
    } finally {
      setLoading(false);
    }
  };

  const detectLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        () => setError("Impossible de détecter la position")
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
      const res = await fetch("/api/vendors/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vendorId: vendor.id,
          ...form,
          ...(location ? { lat: location.lat, lon: location.lon } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSuccess("Boutique mise à jour");
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteVendor = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/vendors/delete", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Erreur lors de la suppression");
      window.location.href = "/vendor/onboarding";
    } catch (err) {
      setError(err.message);
      setDeleting(false);
    }
  };

  const toggleFacilityStatus = async (facilityId, isOnline) => {
    try {
      await fetch("/api/facilities/toggle-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ facilityId, isOnline: !isOnline }),
      });
      await loadVendor();
    } catch {}
  };

  const startEditFacility = (facility) => {
    setEditingFacility(facility.id);
    setFacilityForm({
      name: facility.facility_name || "",
      category: facility.category || "",
      type: facility.type || "fixed",
      description: facility.description || "",
      address: facility.address || "",
    });
  };

  const handleSaveFacility = async (facilityId) => {
    setSavingFacility(true);
    try {
      const res = await fetch(`/api/facilities/${facilityId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(facilityForm),
      });
      if (!res.ok) throw new Error("Erreur");
      setEditingFacility(null);
      await loadVendor();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFacility(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-8 text-center max-w-sm">
          <Store size={28} className="mx-auto mb-4 text-emerald-400" />
          <h2 className="font-space-grotesk text-xl font-bold text-white mb-2">Aucune boutique</h2>
          <p className="font-dm-sans text-sm text-zinc-400 mb-6">Crée ta boutique pour voir les paramètres.</p>
          <Link to="/vendor/onboarding" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all">
            Créer ma boutique
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="max-w-2xl">
        <div className="flex items-center gap-3 mb-8">
          <button onClick={() => window.history.back()} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all">
            <ChevronRight size={14} className="text-white/50 rotate-180" />
          </button>
          <Settings size={20} className="text-emerald-400" />
          <div>
            <h1 className="font-space-grotesk text-xl md:text-2xl font-bold text-white">Paramètres boutique</h1>
            <p className="font-dm-sans text-sm text-zinc-400">{vendor.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Vendor form */}
          <form onSubmit={handleSave} className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Nom de la boutique</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans" />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Catégorie</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full bg-transparent border-none outline-none text-zinc-300 text-sm font-dm-sans appearance-none">
                  <option value="Alimentation" className="bg-zinc-900">Alimentation</option>
                  <option value="Electronique" className="bg-zinc-900">Électronique</option>
                  <option value="Textile" className="bg-zinc-900">Textile</option>
                  <option value="Sante" className="bg-zinc-900">Santé & Beauté</option>
                  <option value="Materiaux" className="bg-zinc-900">Matériaux</option>
                  <option value="Services" className="bg-zinc-900">Services</option>
                  <option value="Autre" className="bg-zinc-900">Autre</option>
                </select>
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Description</label>
              <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                  rows={3} className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans resize-none" />
              </div>
            </div>

            {/* Phone + Email */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Téléphone</label>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                  <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans" />
                </div>
              </div>
              <div>
                <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Email</label>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans" />
                </div>
              </div>
            </div>

            {/* Address + Neighborhood */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Adresse</label>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                  <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans" />
                </div>
              </div>
              <div>
                <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Quartier</label>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50">
                  <input type="text" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}
                    className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans" />
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Localisation sur la carte</label>
              <button type="button" onClick={detectLocation}
                className="flex items-center gap-3 w-full rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 text-sm text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800/70 transition-all font-dm-sans">
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

            <button type="submit" disabled={saving}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all disabled:opacity-50">
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </form>

          {/* Delete vendor */}
          <div className="rounded-2xl border border-red-500/10 bg-red-500/[0.02] p-6">
            <h2 className="font-space-grotesk text-base font-bold text-red-400 mb-2">Supprimer la boutique</h2>
            <p className="font-dm-sans text-sm text-zinc-500 mb-4">
              Supprime ta boutique et tous ses produits. Action irréversible.
            </p>
            {!showDeleteConfirm ? (
              <button onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-500/20 hover:bg-red-500/5 text-red-400 text-sm font-dm-sans transition-all">
                <Trash2 size={16} />
                Supprimer ma boutique
              </button>
            ) : (
              <div>
                <p className="font-dm-sans text-sm text-red-400/80 mb-3">Es-tu sûr ? Tous les produits seront supprimés.</p>
                <div className="flex gap-3">
                  <button onClick={handleDeleteVendor} disabled={deleting}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-semibold text-sm transition-all disabled:opacity-50">
                    {deleting ? "..." : "Confirmer la suppression"}
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)}
                    className="px-4 py-2.5 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 text-sm font-dm-sans transition-all">
                    Annuler
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Facilities Management */}
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-space-grotesk text-base font-bold text-white">Mes activités (facilities)</h2>
              <Link
                to="/vendor/onboarding?addFacility=1"
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-all"
              >
                <Plus size={14} />
                Ajouter
              </Link>
            </div>

            {vendor.facilities?.length > 0 ? (
              <div className="space-y-2">
                {vendor.facilities.map((facility) => (
                  <div key={facility.id}>
                    <div className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-dm-sans font-medium text-zinc-200 text-sm truncate">{facility.facility_name}</h3>
                          {facility.type === 'mobile' && <Globe size={12} className="text-purple-400" />}
                        </div>
                        <p className="font-dm-sans text-xs text-zinc-500 mt-0.5">
                          {facility.category} · {facility.product_count} produit{facility.product_count > 1 ? 's' : ''}
                          {facility.address && ` · ${facility.address}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <button
                          onClick={() => toggleFacilityStatus(facility.id, facility.is_online)}
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] transition-all ${
                            facility.is_online
                              ? 'bg-emerald-500/10 text-emerald-400'
                              : 'bg-zinc-800 text-zinc-500'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${facility.is_online ? 'bg-emerald-400' : 'bg-zinc-500'}`} />
                          {facility.is_online ? 'En ligne' : 'Hors ligne'}
                        </button>
                        <button
                          onClick={() => startEditFacility(facility)}
                          className="p-1.5 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-white transition-all"
                        >
                          <Edit size={14} />
                        </button>
                      </div>
                    </div>
                    {editingFacility === facility.id && (
                      <div className="mt-2 rounded-xl border border-emerald-500/20 bg-zinc-800/50 p-4 space-y-3">
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Nom</label>
                          <input type="text" value={facilityForm.name}
                            onChange={(e) => setFacilityForm({ ...facilityForm, name: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Catégorie</label>
                            <select value={facilityForm.category}
                              onChange={(e) => setFacilityForm({ ...facilityForm, category: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
                            >
                              <option value="Alimentation">Alimentation</option>
                              <option value="Services">Services</option>
                              <option value="Artisanat">Artisanat</option>
                              <option value="Mode">Mode</option>
                              <option value="Maison">Maison</option>
                              <option value="Transport">Transport</option>
                            </select>
                          </div>
                          <div>
                            <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Type</label>
                            <select value={facilityForm.type}
                              onChange={(e) => setFacilityForm({ ...facilityForm, type: e.target.value })}
                              className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300 outline-none focus:border-emerald-500/50"
                            >
                              <option value="fixed">Fixe</option>
                              <option value="mobile">Mobile</option>
                            </select>
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Adresse</label>
                          <input type="text" value={facilityForm.address}
                            onChange={(e) => setFacilityForm({ ...facilityForm, address: e.target.value })}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1 block">Description</label>
                          <textarea value={facilityForm.description}
                            onChange={(e) => setFacilityForm({ ...facilityForm, description: e.target.value })}
                            rows={2}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 outline-none focus:border-emerald-500/50 resize-none"
                          />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingFacility(null)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 text-xs hover:bg-zinc-800 transition-all"
                          >
                            <X size={12} /> Annuler
                          </button>
                          <button onClick={() => handleSaveFacility(facility.id)} disabled={savingFacility}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 text-black text-xs font-medium hover:bg-emerald-400 transition-all disabled:opacity-50"
                          >
                            {savingFacility ? "..." : <><Check size={12} /> Enregistrer</>}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="font-dm-sans text-sm text-zinc-500 text-center py-4">Aucune activité</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
