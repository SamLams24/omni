"use client";

import { useState, useEffect } from "react";
import { Link } from "react-router";
import { X, ShoppingBag, Plus, Minus, Trash2, Send, Loader2, DollarSign, MapPin, Navigation, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const CART_KEY = "omni_cart";

function loadCart() {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : { items: [] };
  } catch {
    return { items: [] };
  }
}

function saveCart(cart) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export default function CartPanel({ isOpen, onClose, onItemCountChange }) {
  const [cart, setCart] = useState({ items: [] });
  const [selectedFacility, setSelectedFacility] = useState(null);
  const [sending, setSending] = useState(false);
  const [deliveryMode, setDeliveryMode] = useState({});
  const [dropoffAddresses, setDropoffAddresses] = useState({});
  const [dropoffCoords, setDropoffCoords] = useState({});
  const [sendingSuccess, setSendingSuccess] = useState(null); // facilityId that was just sent
  const [sentFacilities, setSentFacilities] = useState([]); // { facilityId, vendorName } sent this session
  const [gettingLocation, setGettingLocation] = useState({});

  useEffect(() => {
    if (isOpen) setCart(loadCart());
  }, [isOpen]);

  const updateCart = (newCart) => {
    setCart(newCart);
    saveCart(newCart);
    onItemCountChange?.(newCart.items.length);
  };

  const updateQuantity = (localId, delta) => {
    const newItems = cart.items.map((item) =>
      item._localId === localId
        ? { ...item, quantity: Math.max(1, item.quantity + delta) }
        : item,
    );
    updateCart({ items: newItems });
  };

  const removeItem = (localId) => {
    const newItems = cart.items.filter((item) => item._localId !== localId);
    updateCart({ items: newItems });
    toast("Produit retiré du panier");
  };

  const clearCart = () => {
    updateCart({ items: [] });
    toast("Panier vidé");
  };

  // Group items by facility
  const groups = {};
  let facilityIds = [];
  for (const item of cart.items) {
    if (!groups[item.facilityId]) {
      groups[item.facilityId] = {
        facilityId: item.facilityId,
        facilityName: item.facilityName,
        vendorName: item.vendorName,
        vendorId: item.vendorId,
        items: [],
      };
      facilityIds.push(item.facilityId);
    }
    groups[item.facilityId].items.push(item);
  }
  const facilityGroups = facilityIds.map((id) => groups[id]);

  const sendCart = async (facilityId) => {
    let userId = null;
    try {
      const { authFetch } = await import("@/lib/auth-client");
      const authRes = await authFetch("/api/auth/session");
      const authData = await authRes.json();
      userId = authData?.user?.id || null;
    } catch {}

    if (!userId) {
      window.location.href = "/auth";
      return;
    }

    const group = groups[facilityId];
    setSelectedFacility(facilityId);
    setSending(true);
    setSendingSuccess(null);

    try {
      const useDelivery = deliveryMode[facilityId] === "delivery";
      const coords = dropoffCoords[facilityId] || {};
      const body = {
        facilityId,
        items: group.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
        })),
        paymentMethod: "cash",
        ...(useDelivery ? {
          delivery: true,
          dropoffAddress: dropoffAddresses[facilityId] || "",
          dropoffLat: coords.lat || null,
          dropoffLon: coords.lon || null,
        } : {}),
      };

      const response = await fetch("/api/cart/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || "Erreur lors de l'envoi");
      }

      // Remove sent items from cart
      const remainingItems = cart.items.filter(
        (item) => item.facilityId !== facilityId,
      );
      updateCart({ items: remainingItems });
      setSendingSuccess(facilityId);
      setSentFacilities([...sentFacilities, { facilityId, vendorName: group.vendorName }]);
      toast("Demande envoyée au vendeur !");
    } catch (err) {
      console.error(err);
      toast(err.message || "Erreur lors de l'envoi");
      setSendingSuccess(null);
    } finally {
      setSending(false);
      setSelectedFacility(null);
    }
  };

  const getLocation = (facilityId) => {
    if (!navigator.geolocation) {
      toast("Géolocalisation non disponible");
      return;
    }
    setGettingLocation({ ...gettingLocation, [facilityId]: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        setDropoffCoords({ ...dropoffCoords, [facilityId]: coords });
        setDropoffAddresses({ ...dropoffAddresses, [facilityId]: `${coords.lat.toFixed(4)}, ${coords.lon.toFixed(4)}` });
        toast("Position détectée !");
        setGettingLocation({ ...gettingLocation, [facilityId]: false });
      },
      () => {
        toast("Impossible d'obtenir ta position");
        setGettingLocation({ ...gettingLocation, [facilityId]: false });
      },
      { timeout: 10000, enableHighAccuracy: true },
    );
  };

  if (!isOpen) return null;

  const total = cart.items.length;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={onClose} />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-sm bg-neutral-900 border-l border-white/10 z-50 flex flex-col animate-slide-left shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-emerald-400" />
            <h2 className="text-white font-medium text-sm">Panier ({total})</h2>
          </div>
          <div className="flex items-center gap-2">
            {total > 0 && (
              <button
                onClick={clearCart}
                className="text-xs text-red-400/60 hover:text-red-400 transition-colors"
              >
                Tout vider
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/5 flex items-center justify-center"
            >
              <X size={14} className="text-white/50" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Success banners for sent facilities */}
          {sentFacilities.map(s => (
            <div key={`sent-${s.facilityId}`} className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <CheckCircle size={16} />
                <span>Demande envoyée à {s.vendorName} !</span>
              </div>
              <Link to="/cart/history" className="text-emerald-400/60 underline text-xs mt-1 inline-block hover:text-emerald-300">Voir mes commandes</Link>
            </div>
          ))}
          {total === 0 ? (
            <div className="text-center py-12">
              <ShoppingBag size={40} className="mx-auto mb-3 text-zinc-600" />
              <p className="text-white/40 text-sm">Panier vide</p>
              <p className="text-white/20 text-xs mt-1">
                Ajoute des produits depuis la carte
              </p>
            </div>
          ) : (
            facilityGroups.map((group) => (
              <div key={group.facilityId} className="rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden">
                {/* Facility header */}
                <div className="px-4 py-3 bg-white/[0.03] border-b border-white/5">
                  <h3 className="text-white text-sm font-medium">{group.facilityName}</h3>
                  <p className="text-white/30 text-xs">{group.vendorName}</p>
                </div>

                {/* Items */}
                <div className="divide-y divide-white/5">
                  {group.items.map((item) => (
                    <div key={item._localId} className="px-4 py-3">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1 min-w-0 mr-3">
                          <h4 className="text-white/80 text-sm truncate">{item.productName}</h4>
                          <p className="text-emerald-400/60 text-xs mt-0.5">
                            {item.price?.toLocaleString()} FCFA / {item.unit}
                          </p>
                        </div>
                        <button
                          onClick={() => removeItem(item._localId)}
                          className="p-1 text-zinc-500 hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>

                      {/* Quantity controls */}
                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => updateQuantity(item._localId, -1)}
                          disabled={item.quantity <= 1}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center disabled:opacity-30 transition-all"
                        >
                          <Minus size={12} className="text-white/60" />
                        </button>
                        <span className="text-white text-sm font-medium w-6 text-center">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => updateQuantity(item._localId, 1)}
                          className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center transition-all"
                        >
                          <Plus size={12} className="text-white/60" />
                        </button>
                        <span className="text-white/30 text-xs ml-auto">
                          {(item.price * item.quantity).toLocaleString()} FCFA
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Send section */}
                <div className="px-4 py-3 border-t border-white/5 bg-white/[0.01] space-y-2">
                  {/* Delivery mode toggle */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeliveryMode({ ...deliveryMode, [group.facilityId]: "pickup" })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                        (deliveryMode[group.facilityId] || "pickup") === "pickup"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 text-white/30 border border-white/10"
                      }`}
                    >
                      🗺️ Je vais chercher
                    </button>
                    <button
                      onClick={() => setDeliveryMode({ ...deliveryMode, [group.facilityId]: "delivery" })}
                      className={`flex-1 py-2 rounded-lg text-[10px] font-medium transition-all ${
                        deliveryMode[group.facilityId] === "delivery"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-white/5 text-white/30 border border-white/10"
                      }`}
                    >
                      🛵 Livraison Omni
                    </button>
                  </div>
                  {deliveryMode[group.facilityId] === "delivery" && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input
                          value={dropoffAddresses[group.facilityId] || ""}
                          onChange={(e) => setDropoffAddresses({ ...dropoffAddresses, [group.facilityId]: e.target.value })}
                          placeholder="Adresse de livraison"
                          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 placeholder-white/30 outline-none"
                        />
                        <button
                          onClick={() => getLocation(group.facilityId)}
                          disabled={gettingLocation[group.facilityId]}
                          className="px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all shrink-0"
                          title="Utiliser ma position"
                        >
                          {gettingLocation[group.facilityId] ? (
                            <Loader2 size={14} className="animate-spin" />
                          ) : (
                            <MapPin size={14} />
                          )}
                        </button>
                      </div>
                      {dropoffCoords[group.facilityId] && (
                        <p className="text-[10px] text-emerald-400/60 flex items-center gap-1">
                          <Navigation size={8} /> Position détectée ✓
                        </p>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => sendCart(group.facilityId)}
                    disabled={sending && selectedFacility === group.facilityId}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm transition-all disabled:opacity-50"
                  >
                    {sending && selectedFacility === group.facilityId ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Send size={14} />
                    )}
                    Envoyer la demande à {group.vendorName}
                  </button>
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Payment method selector */}
        {total > 0 && (
          <div className="px-5 py-3 border-t border-white/10 bg-white/[0.02]">
            <label className="text-xs text-white/30 mb-2 block">Mode de paiement</label>
            <div className="flex items-center gap-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
              <DollarSign size={12} />
              Paiement en espèces
            </div>
          </div>
        )}

        {/* Total */}
        {total > 0 && (
          <div className="px-5 py-3 border-t border-white/10">
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/40">Total estimé</span>
              <span className="text-emerald-400 font-medium">
                {cart.items.reduce((sum, item) => sum + item.price * item.quantity, 0).toLocaleString()} FCFA
              </span>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes slide-left {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        .animate-slide-left {
          animation: slide-left 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
