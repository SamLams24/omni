"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router";
import {
  Power,
  PowerOff,
  Loader2,
  Plus,
  FileText,
  MessageSquare,
  Store,
  Edit,
  Trash2,
  Package,
  ShoppingCart,
  MapPin,
  Globe,
} from "lucide-react";
import RespondModal from "@/components/RespondModal";
import SubscriptionBadge from "@/components/SubscriptionBadge";

export default function VendorDashboardPage() {
  const [vendor, setVendor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [togglingFacility, setTogglingFacility] = useState(null);
  const [stats, setStats] = useState({ requests: 0, messages: 0 });
  const [pendingCarts, setPendingCarts] = useState([]);
  const [cartsLoading, setCartsLoading] = useState(false);
  const [respondingCart, setRespondingCart] = useState(null);

  // Inline product management
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({ name: "", price: "", unit: "pièce" });
  const [productError, setProductError] = useState("");
  const [savingProduct, setSavingProduct] = useState(false);

  useEffect(() => {
    loadVendorData();
  }, []);

  const loadVendorData = async () => {
    try {
      const response = await fetch("/api/vendors/my-vendor");

      if (!response.ok) {
        setVendor(null);
        setLoading(false);
        return;
      }

      const data = await response.json();
      setVendor(data.vendor);

      if (data.vendor) {
        const requestsRes = await fetch("/api/vendors/requests");
        const requestsData = await requestsRes.json();

        const convsRes = await fetch("/api/vendors/conversations");
        const convsData = await convsRes.json();

        setStats({
          requests: requestsData.requests?.length || 0,
          messages: convsData.conversations?.length || 0,
        });

        // Fetch pending carts
        try {
          const cartsRes = await fetch(`/api/cart/vendor-pending`);
          if (cartsRes.ok) {
            const cd = await cartsRes.json();
            setPendingCarts(cd.carts || []);
          }
        } catch {}
      }
    } catch (err) {
      console.error(err);
      setVendor(null);
    } finally {
      setLoading(false);
    }
  };

  const toggleFacilityStatus = async (facilityId, isOnline) => {
    setTogglingFacility(facilityId);
    try {
      const response = await fetch("/api/facilities/toggle-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          facilityId,
          isOnline: !isOnline,
        }),
      });

      if (!response.ok) throw new Error("Failed to toggle status");

      await loadVendorData();
    } catch (err) {
      console.error(err);
    } finally {
      setTogglingFacility(null);
    }
  };

  const handleSaveProduct = async (e) => {
    e.preventDefault();
    setProductError("");
    setSavingProduct(true);

    try {
      const url = editingProduct
        ? `/api/vendors/products/${editingProduct.id}`
        : "/api/vendors/products/create";

      const response = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          vendorId: vendor.id,
          ...productForm,
          price: parseFloat(productForm.price),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Erreur");
      }

      await loadVendorData();
      setShowProductForm(false);
      setEditingProduct(null);
      setProductForm({ name: "", price: "", unit: "pièce" });
    } catch (err) {
      setProductError(err.message);
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (productId) => {
    if (!confirm("Supprimer ce produit ?")) return;

    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erreur");

      await loadVendorData();
    } catch (err) {
      console.error(err);
    }
  };

  const openEditProduct = (product) => {
    setEditingProduct(product);
    setProductForm({
      name: product.name,
      price: product.price.toString(),
      unit: product.unit || "pièce",
    });
    setShowProductForm(true);
  };

  const openAddProduct = () => {
    setEditingProduct(null);
    setProductForm({ name: "", price: "", unit: "pièce" });
    setShowProductForm(true);
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
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mx-auto mb-5">
            <Store size={28} className="text-emerald-400" />
          </div>
          <h2 className="font-space-grotesk text-2xl font-bold text-white mb-2">
            Aucune boutique trouvée
          </h2>
          <p className="font-dm-sans text-sm text-zinc-400 mb-8">
            Crée ta boutique pour commencer à vendre.
          </p>
          <Link
            to="/vendor/onboarding"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
          >
            Créer ma boutique
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="font-space-grotesk text-2xl md:text-3xl font-bold text-white">{vendor.name}</h1>
          <SubscriptionBadge tier={vendor.vendor_tier} compact />
        </div>
        <p className="font-dm-sans text-sm text-zinc-400 mt-1">{vendor.category}</p>
      </div>

      <div className="max-w-6xl mx-auto space-y-6">
        {/* Facilities List */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 md:p-8 transition-all hover:border-white/20">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-space-grotesk text-xl font-bold text-white mb-1">
                Mes activités
              </h2>
              <p className="font-dm-sans text-sm text-zinc-400">
                {vendor.facilities?.length || 0} facility/vendor
              </p>
            </div>
            <Link
              to="/vendor/settings"
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium transition-all"
            >
              <Plus size={14} />
              Ajouter
            </Link>
          </div>

          {vendor.facilities?.length > 0 ? (
            <div className="space-y-3">
              {vendor.facilities.map((facility) => (
                <div
                  key={facility.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-4 py-3 flex items-center justify-between transition-all hover:bg-zinc-800/50 hover:scale-[1.02]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-dm-sans font-medium text-zinc-200 text-sm truncate">{facility.facility_name}</h3>
                      {facility.type === 'mobile' && (
                        <Globe size={12} className="text-purple-400 shrink-0" />
                      )}
                      {facility.type === 'fixed' && (
                        <MapPin size={12} className="text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="font-dm-sans text-xs text-zinc-500 mt-0.5">{facility.category} · {facility.product_count} produit{facility.product_count > 1 ? 's' : ''}</p>
                  </div>
                  <button
                    onClick={() => toggleFacilityStatus(facility.id, facility.is_online)}
                    disabled={togglingFacility === facility.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all shrink-0 ml-3 ${
                      facility.is_online
                        ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        : "bg-zinc-800/50 text-zinc-500 hover:bg-zinc-800"
                    } ${togglingFacility === facility.id ? "opacity-50" : ""}`}
                  >
                    {togglingFacility === facility.id ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : facility.is_online ? (
                      <Power size={14} />
                    ) : (
                      <PowerOff size={14} />
                    )}
                    <span className="text-xs font-medium">{facility.is_online ? "En ligne" : "Hors ligne"}</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <MapPin size={24} className="text-white/30" />
              </div>
              <p className="text-white/30 text-sm">Aucune activité</p>
              <p className="text-white/10 text-xs mt-1">Ajoute une activité pour commencer à vendre</p>
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <FileText size={22} className="text-emerald-400" />
              </div>
              <div>
                <p className="font-dm-sans text-sm text-zinc-400">Demandes</p>
                <p className="font-space-grotesk text-3xl font-bold text-white">{stats.requests}</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition-all hover:scale-[1.02]">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <MessageSquare size={22} className="text-blue-400" />
              </div>
              <div>
                <p className="font-dm-sans text-sm text-zinc-400">Messages</p>
                <p className="font-space-grotesk text-3xl font-bold text-white">{stats.messages}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pending Carts */}
        {pendingCarts.length > 0 ? (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 transition-all hover:border-white/20">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-space-grotesk text-lg font-bold text-white">Demandes groupées ({pendingCarts.length})</h2>
            </div>
            <div className="space-y-3">
              {pendingCarts.map((cart) => (
                <div key={cart.id} className="rounded-xl border border-zinc-800 bg-zinc-800/30 p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-zinc-200 text-sm font-medium">{cart.facility_name}</p>
                      <p className="text-zinc-500 text-xs">{cart.buyer_name} · {cart.buyer_phone}</p>
                      <p className="text-zinc-500 text-[10px] mt-0.5">{new Date(cart.created_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit" })}</p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] border ${
                      cart.status === 'pending' ? 'text-amber-400 border-amber-500/20 bg-amber-500/10' :
                      cart.status === 'confirmed' ? 'text-emerald-400 border-emerald-500/20 bg-emerald-500/10' :
                      'text-blue-400 border-blue-500/20 bg-blue-500/10'
                    }`}>
                      {cart.status === 'pending' ? 'Nouveau' : cart.status === 'confirmed' ? 'Confirmé' : 'Partiel'}
                    </span>
                  </div>
                  {cart.items?.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-1.5 border-t border-zinc-800/50">
                      <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${item.status === 'pending' ? 'bg-amber-400' : item.status === 'confirmed' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className="text-zinc-400 text-xs">{item.product_name}</span>
                        <span className="text-zinc-600 text-[10px]">x{item.quantity_requested}</span>
                      </div>
                      <span className="text-zinc-500 text-xs">{(item.product_price * item.quantity_requested).toLocaleString()} FCFA</span>
                    </div>
                  ))}
                  {cart.status === 'pending' && (
                    <button
                      onClick={() => setRespondingCart(cart)}
                      className="w-full mt-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium hover:bg-emerald-500/20 transition-all"
                    >
                      Répondre à cette demande
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
            <div className="text-center py-12">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                <ShoppingCart size={24} className="text-white/30" />
              </div>
              <p className="text-white/30 text-sm">Aucune demande groupée</p>
              <p className="text-white/10 text-xs mt-1">Les demandes des clients apparaîtront ici</p>
            </div>
          )}

        {/* Respond modal */}
        {respondingCart && (
          <RespondModal
            cart={respondingCart}
            onClose={() => setRespondingCart(null)}
            onDone={() => { setRespondingCart(null); window.location.reload(); }}
          />
        )}

        {/* Products Card — full management inline */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60 transition-all hover:border-white/20">
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <h2 className="font-space-grotesk text-lg font-bold text-white">Mes produits</h2>
            <button
              onClick={openAddProduct}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
            >
              <Plus size={16} />
              Ajouter
            </button>
          </div>

          {/* Inline product form */}
          {showProductForm && (
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center gap-3 mb-4">
                <Package size={16} className="text-emerald-400" />
                <h3 className="font-space-grotesk font-bold text-zinc-300 text-sm">
                  {editingProduct ? "Modifier le produit" : "Nouveau produit"}
                </h3>
              </div>
              <form onSubmit={handleSaveProduct} className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <div className="col-span-3 sm:col-span-1">
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 transition-all focus-within:border-emerald-500/50">
                      <input
                        type="text"
                        required
                        value={productForm.name}
                        onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                        placeholder="Nom du produit"
                        className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5 transition-all focus-within:border-emerald-500/50">
                      <input
                        type="number"
                        required
                        min="0"
                        value={productForm.price}
                        onChange={(e) => setProductForm({ ...productForm, price: e.target.value })}
                        placeholder="Prix (FCFA)"
                        className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                      />
                    </div>
                  </div>
                  <div>
                    <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-2.5">
                      <select
                        value={productForm.unit}
                        onChange={(e) => setProductForm({ ...productForm, unit: e.target.value })}
                        className="w-full bg-transparent border-none outline-none text-zinc-400 text-sm font-dm-sans appearance-none"
                      >
                        <option value="pièce" className="bg-zinc-900">pièce</option>
                        <option value="kg" className="bg-zinc-900">kg</option>
                        <option value="litre" className="bg-zinc-900">litre</option>
                        <option value="sac" className="bg-zinc-900">sac</option>
                      </select>
                    </div>
                  </div>
                </div>

                {productError && (
                  <div className="px-4 py-2.5 rounded-xl border border-red-500/30 bg-red-500/10">
                    <p className="font-dm-sans text-sm text-red-400">{productError}</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={savingProduct}
                    className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs transition-all disabled:opacity-50"
                  >
                    {savingProduct ? "..." : editingProduct ? "Enregistrer" : "Ajouter"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowProductForm(false);
                      setEditingProduct(null);
                      setProductForm({ name: "", price: "", unit: "pièce" });
                    }}
                    className="px-4 py-2 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-xs font-dm-sans transition-all"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Products list */}
          <div className="p-6">
            {vendor.products && vendor.products.length > 0 ? (
              <div className="space-y-3">
                {vendor.products.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-5 py-4 flex items-center justify-between transition-all hover:bg-zinc-800/50 hover:scale-[1.02]"
                  >
                    <div>
                      <h3 className="font-dm-sans font-medium text-zinc-200">{product.name}</h3>
                      <p className="font-dm-sans text-sm text-emerald-400 mt-1">
                        {product.price} FCFA / {product.unit}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEditProduct(product)}
                        className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        <Edit size={15} />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(product.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                  <Package size={24} className="text-white/30" />
                </div>
                <p className="text-white/30 text-sm">Aucun produit</p>
                <p className="text-white/10 text-xs mt-1">Ajoute ton premier produit pour commencer à vendre</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
