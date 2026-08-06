"use client";

import { useState, useEffect } from "react";
import { Loader2, Store, MapPin, Package, Plus, Trash2, ChevronRight, ArrowLeft } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export default function VendorOnboardingPage() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { authFetch } = await import("@/lib/auth-client");
        const res = await authFetch("/api/auth/session");
        const data = await res.json();
        if (data?.user) {
          setUser(data.user);
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      } finally {
        setUserLoading(false);
      }
    };
    fetchUser();
  }, []);

  // Vendor info
  const [vendorName, setVendorName] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState(null);

  // Products
  const [products, setProducts] = useState([
    { name: "", price: "", unit: "pièce" },
  ]);

  // Redirect to dashboard if user already has a vendor
  useEffect(() => {
    let mounted = true;

    const checkVendor = async () => {
      if (!user) return;
      try {
        const response = await fetch("/api/vendors/my-vendor");
        const data = await response.json();
        if (mounted && data.vendor) {
          window.location.href = "/vendor/dashboard";
        }
      } catch {
        // No vendor yet — continue onboarding
      }
    };

    if (!userLoading) {
      checkVendor();
    }
    return () => { mounted = false; };
  }, [user, userLoading]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
        },
        () => setLocation({ lat: 6.1319, lon: 1.2228 }),
      );
    } else {
      setLocation({ lat: 6.1319, lon: 1.2228 });
    }
  }, []);

  const addProduct = () => {
    setProducts([...products, { name: "", price: "", unit: "unité" }]);
  };

  const removeProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (step === 1) {
      if (!vendorName || !category || !location) {
        setError("Veuillez remplir tous les champs obligatoires");
        return;
      }
      setStep(2);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/vendors/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: vendorName,
          category,
          description,
          phone,
          lat: location.lat,
          lon: location.lon,
          products: products.filter((p) => p.name && p.price),
        }),
      });

      if (!response.ok) {
        throw new Error("Erreur lors de la création de votre boutique");
      }

      window.location.href = "/vendor/dashboard";
    } catch (err) {
      setError(err.message || "Une erreur est survenue");
      setLoading(false);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#08080f] flex items-center justify-center p-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Store size={28} className="text-emerald-400" />
          </div>
          <h1 className="font-space-grotesk text-2xl font-bold text-white/90 mb-2">Connecte-toi pour continuer</h1>
          <p className="font-dm-sans text-sm text-white/40 mb-8">Tu dois avoir un compte pour créer ta boutique.</p>
          <a href="/auth?callbackUrl=/vendor/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
          >
            Se connecter
            <ChevronRight size={16} />
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#08080f] flex items-start justify-center px-4 py-12 md:py-20">
      <div className="w-full max-w-lg">
        {/* Step indicator */}
        <div className="flex items-center gap-3 mb-10">
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 1 ? 'bg-emerald-400' : 'bg-white/10'}`} />
          <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${step >= 2 ? 'bg-emerald-400' : 'bg-white/10'}`} />
          <span className="font-dm-sans text-xs text-white/30 shrink-0">Étape {step}/2</span>
        </div>

        <form onSubmit={handleSubmit}>
          {step === 1 ? (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-1">
                <Store size={20} className="text-emerald-400" />
                <h2 className="font-space-grotesk text-xl md:text-2xl font-bold text-white/90">Crée ta boutique</h2>
              </div>
              <p className="font-dm-sans text-sm text-white/40 mb-8 ml-[36px]">
                Visible pour tous les acheteurs autour de toi.
              </p>

              {/* Name */}
              <div className="mb-5">
                <label className="font-dm-sans block text-sm text-white/50 mb-2">Nom de la boutique *</label>
                <div className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-white/[0.06]">
                  <Store size={16} className="text-emerald-400 shrink-0" />
                  <input
                    required
                    type="text"
                    value={vendorName}
                    onChange={(e) => setVendorName(e.target.value)}
                    placeholder="Ex: Boutique Ama"
                    className="flex-1 bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/20 font-dm-sans"
                  />
                </div>
              </div>

              {/* Category + Phone */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                <div>
                  <label className="font-dm-sans block text-sm text-white/50 mb-2">Catégorie *</label>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-white/[0.06]">
                    <select
                      required
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-transparent border-none outline-none text-white/60 text-sm font-dm-sans appearance-none"
                    >
                      <option value="" className="bg-[#08080f]">Sélectionne une catégorie</option>
                      <option value="Alimentation" className="bg-[#08080f]">Alimentation</option>
                      <option value="Electronique" className="bg-[#08080f]">Électronique</option>
                      <option value="Textile" className="bg-[#08080f]">Textile</option>
                      <option value="Sante" className="bg-[#08080f]">Santé & Beauté</option>
                      <option value="Materiaux" className="bg-[#08080f]">Matériaux</option>
                      <option value="Services" className="bg-[#08080f]">Services</option>
                      <option value="Autre" className="bg-[#08080f]">Autre</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="font-dm-sans block text-sm text-white/50 mb-2">Téléphone</label>
                  <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-white/[0.06]">
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+228 XX XX XX"
                      className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/20 font-dm-sans"
                    />
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-5">
                <label className="font-dm-sans block text-sm text-white/50 mb-2">Description</label>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-white/[0.06]">
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Décris ce que tu vends..."
                    rows={2}
                    className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/20 font-dm-sans resize-none"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="mb-8">
                <label className="font-dm-sans block text-sm text-white/50 mb-2">Localisation</label>
                <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3">
                  <MapPin size={16} className="text-emerald-400 shrink-0" />
                  {location ? (
                    <span className="font-dm-sans text-sm text-emerald-400/80">
                      Position détectée
                    </span>
                  ) : (
                    <span className="font-dm-sans text-sm text-white/30">
                      Détection en cours...
                    </span>
                  )}
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                  <p className="font-dm-sans text-sm text-red-400">{error}</p>
                </div>
              )}

              <button
                type="submit"
                className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
              >
                Continuer
                <ChevronRight size={16} />
              </button>

              <p className="font-dm-sans text-xs text-white/20 text-center mt-5">
                Déjà inscrit ?{' '}
                <a href="/vendor/dashboard" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                  Accède à ton tableau de bord
                </a>
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 md:p-8">
              <div className="flex items-center gap-3 mb-1">
                <Package size={20} className="text-emerald-400" />
                <h2 className="font-space-grotesk text-xl md:text-2xl font-bold text-white/90">Ajoute tes produits</h2>
              </div>
              <p className="font-dm-sans text-sm text-white/40 mb-8 ml-[36px]">
                Au moins un produit pour commencer.
              </p>

              <div className="space-y-4 mb-6">
                {products.map((product, index) => (
                  <div key={index}
                    className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-dm-sans text-xs text-white/30">Produit {index + 1}</span>
                      {products.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeProduct(index)}
                          className="flex items-center gap-1 text-red-400/60 hover:text-red-400 text-xs transition-colors font-dm-sans"
                        >
                          <Trash2 size={12} />
                          Supprimer
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-3 sm:col-span-1">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 transition-all focus-within:border-emerald-500/50">
                          <input
                            type="text"
                            value={product.name}
                            onChange={(e) => updateProduct(index, "name", e.target.value)}
                            placeholder="Nom du produit"
                            className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/20 font-dm-sans"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 transition-all focus-within:border-emerald-500/50">
                          <input
                            type="number"
                            value={product.price}
                            onChange={(e) => updateProduct(index, "price", e.target.value)}
                            placeholder="Prix"
                            className="w-full bg-transparent border-none outline-none text-white/80 text-sm placeholder:text-white/20 font-dm-sans"
                          />
                        </div>
                      </div>
                      <div>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5">
                          <input
                            type="text"
                            value={product.unit}
                            onChange={(e) => updateProduct(index, "unit", e.target.value)}
                            placeholder="Unité"
                            className="w-full bg-transparent border-none outline-none text-white/60 text-sm placeholder:text-white/20 font-dm-sans"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addProduct}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-white/[0.08] hover:border-emerald-500/30 text-white/40 hover:text-emerald-400 text-sm font-dm-sans transition-all mb-6"
              >
                <Plus size={14} />
                Ajouter un produit
              </button>

              {error && (
                <div className="mb-5 px-4 py-3 rounded-xl border border-red-500/20 bg-red-500/[0.06]">
                  <p className="font-dm-sans text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setStep(1); setError(null); }}
                  className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-white/60 hover:text-white/80 text-sm font-dm-sans transition-all"
                >
                  <ArrowLeft size={14} />
                  Retour
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>Créer ma boutique <ChevronRight size={16} /></>
                  )}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
