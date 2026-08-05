"use client";

import { useState, useEffect } from "react";
import { Plus, Edit, Trash2, Loader2, Package } from "lucide-react";

export default function VendorProductsPage() {
  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    price: "",
    unit: "pièce",
  });
  const [error, setError] = useState("");

  useEffect(() => {
    loadVendorData();
  }, []);

  const loadVendorData = async () => {
    try {
      const response = await fetch("/api/vendors/my-vendor");

      if (!response.ok) throw new Error("Failed to load vendor");

      const data = await response.json();
      setVendor(data.vendor);
      setProducts(data.vendor?.products || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const url = editingProduct
        ? `/api/vendors/products/${editingProduct.id}`
        : "/api/vendors/products/create";

      const response = await fetch(url, {
        method: editingProduct ? "PUT" : "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorId: vendor.id,
          ...formData,
          price: parseFloat(formData.price),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to save product");
      }

      loadVendorData();
      setShowForm(false);
      setEditingProduct(null);
      setFormData({ name: "", price: "", unit: "pièce" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!confirm("Supprimer ce produit?")) return;

    try {
      const response = await fetch(`/api/vendors/products/${productId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete product");

      loadVendorData();
    } catch (err) {
      console.error(err);
    }
  };

  if (loading && !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-emerald-400" size={32} />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-space-grotesk text-2xl md:text-3xl font-bold text-white">Mes produits</h1>
          {vendor && (
            <p className="font-dm-sans text-sm text-zinc-400 mt-1">{vendor.name}</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all"
        >
          <Plus size={16} />
          Ajouter
        </button>
      </div>

      <div className="max-w-4xl space-y-6">
        {/* Add/Edit Form */}
        {showForm && (
          <div className="rounded-2xl border border-white/10 bg-zinc-900/60 p-6 md:p-8">
            <div className="flex items-center gap-3 mb-6">
              <Package size={18} className="text-emerald-400" />
              <h2 className="font-space-grotesk text-lg font-bold text-white">
                {editingProduct ? "Modifier le produit" : "Nouveau produit"}
              </h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Nom du produit *</label>
                <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-zinc-800/70">
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Tomates fraîches"
                    className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                  />
                </div>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl border border-red-500/30 bg-red-500/10">
                  <p className="font-dm-sans text-sm text-red-400">{error}</p>
                </div>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Prix (FCFA) *</label>
                  <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-zinc-800/70">
                    <input
                      type="number"
                      required
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="500"
                      className="w-full bg-transparent border-none outline-none text-zinc-200 text-sm placeholder:text-zinc-600 font-dm-sans"
                    />
                  </div>
                </div>
                <div>
                  <label className="font-dm-sans block text-sm text-zinc-400 mb-2">Unité *</label>
                  <div className="rounded-xl border border-zinc-700 bg-zinc-800/50 px-4 py-3 transition-all focus-within:border-emerald-500/50 focus-within:bg-zinc-800/70">
                    <select
                      value={formData.unit}
                      onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
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

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Enregistrement..." : "Enregistrer"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setEditingProduct(null);
                    setFormData({ name: "", price: "", unit: "pièce" });
                  }}
                  className="px-6 py-3 rounded-xl border border-zinc-700 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-300 text-sm font-dm-sans transition-all"
                >
                  Annuler
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Products List */}
        <div className="rounded-2xl border border-white/10 bg-zinc-900/60">
          <div className="p-6 md:p-8">
            {products.length > 0 ? (
              <div className="space-y-3">
                {products.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-800/30 px-5 py-4 flex items-center justify-between transition-all hover:bg-zinc-800/50"
                  >
                    <div>
                      <h3 className="font-dm-sans font-medium text-zinc-200">{product.name}</h3>
                      <p className="font-dm-sans text-sm text-emerald-400 mt-1">
                        {product.price} FCFA / {product.unit}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingProduct(product);
                          setFormData({
                            name: product.name,
                            price: product.price.toString(),
                            unit: product.unit || "pièce",
                          });
                          setShowForm(true);
                        }}
                        className="p-2 text-zinc-500 hover:text-emerald-400 transition-colors"
                      >
                        <Edit size={16} />
                      </button>
                      <button
                        onClick={() => handleDelete(product.id)}
                        className="p-2 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="font-dm-sans text-sm text-zinc-500">
                  Aucun produit. Ajoute ton premier produit.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
