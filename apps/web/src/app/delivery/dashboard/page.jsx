import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import DeliveryDashboard from "@/components/DeliveryDashboard";

export default function DeliveryDashboardPage() {
  const [profile, setProfile] = useState(null);
  const [trips, setTrips] = useState([]);
  const [allMatches, setAllMatches] = useState({});
  const [available, setAvailable] = useState([]);
  const [myDeliveries, setMyDeliveries] = useState([]);
  const [accepting, setAccepting] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [profRes, tripsRes, availRes, myDelRes] = await Promise.all([
        fetch("/api/delivery/profile"),
        fetch("/api/delivery/trips/active"),
        fetch("/api/delivery/available"),
        fetch("/api/delivery/my-active"),
      ]);

      if (!profRes.ok || !tripsRes.ok) throw new Error();

      const profData = await profRes.json();
      const tripsData = await tripsRes.json();
      const availData = await availRes.json();
      const myDelData = await myDelRes.json();
      setProfile(profData.profile || null);
      setTrips(tripsData.trips || []);
      setAvailable(availData.available || []);
      setMyDeliveries(myDelData.deliveries || []);

      const matchResults = {};
      for (const trip of (tripsData.trips || [])) {
        try {
          const mRes = await fetch("/api/delivery/match", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tripId: trip.id }),
          });
          if (mRes.ok) {
            const mData = await mRes.json();
            matchResults[trip.id] = mData.matches || [];
          }
        } catch {}
      }
      setAllMatches(matchResults);
    } catch {
      toast("Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const toggleActive = async () => {
    setToggling(true);
    try {
      const res = await fetch("/api/delivery/toggle", {
        method: "POST",
      });
      if (!res.ok) { const err = await res.json(); toast(err.error || "Erreur"); return; }
      toast(profile?.is_active ? "Désactivé" : "Activé !");
      loadData();
    } catch { toast("Erreur"); } finally { setToggling(false); }
  };

  const switchMode = async (mode) => {
    try {
      const res = await fetch("/api/delivery/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMode: mode }),
      });
      if (res.ok) loadData();
    } catch {}
  };

  const deactivateTrip = async (tripId) => {
    const res = await fetch(`/api/delivery/planned-trip/${tripId}`, {
      method: "DELETE",
    });
    if (res.ok) { toast("Trajet désactivé"); loadData(); }
  };

  const acceptMatch = async (requestId, tripId) => {
    setAccepting(requestId);
    try {
      const res = await fetch("/api/delivery/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, tripId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast("Livraison acceptée !");
      loadData();
    } catch (err) { toast(err.message || "Erreur"); } finally { setAccepting(null); }
  };

  const confirmDelivery = async (requestId) => {
    setConfirming(requestId);
    try {
      const res = await fetch("/api/delivery/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId }),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error); }
      toast("Livraison confirmée !");
      loadData();
    } catch (err) { toast(err.message || "Erreur"); } finally { setConfirming(null); }
  };

  const switchVehicle = async (type) => {
    await fetch("/api/delivery/vehicles/switch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type }),
    });
    loadData();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-white/30" />
      </div>
    );
  }

  return (
    <DeliveryDashboard
      profile={profile}
      trips={trips}
      allMatches={allMatches}
      available={available}
      myDeliveries={myDeliveries}
      accepting={accepting}
      confirming={confirming}
      toggling={toggling}
      onToggle={toggleActive}
      onSwitchMode={switchMode}
      onDeactivateTrip={deactivateTrip}
      onAcceptMatch={acceptMatch}
      onConfirmDelivery={confirmDelivery}
      onSwitchVehicle={switchVehicle}
    />
  );
}
