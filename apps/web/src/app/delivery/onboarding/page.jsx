"use client";

import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Loader2, Truck, ArrowLeft, Bike, Footprints, Car, Smartphone, Upload, MapPin } from "lucide-react";
import { toast } from "sonner";
import KycForm from "@/components/KycForm";

const VEHICLES = [
  { type: "pedestrian", label: "À pied", icon: Footprints, desc: "Livraisons de proximité" },
  { type: "bicycle", label: "Vélo", icon: Bike, desc: "Jusqu'à 5 km" },
  { type: "motorcycle", label: "Moto", icon: Smartphone, desc: "Jusqu'à 15 km" },
  { type: "car", label: "Voiture", icon: Car, desc: "Jusqu'à 30 km" },
  { type: "truck", label: "Camion", icon: Truck, desc: "Grand volume" },
];

export default function DeliveryOnboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [idType, setIdType] = useState(null);
  const [idNumber, setIdNumber] = useState("");
  const [vehicleType, setVehicleType] = useState(null);
  const [sending, setSending] = useState(false);
  const [kycAddress, setKycAddress] = useState("");
  const [kycDocUploaded, setKycDocUploaded] = useState(false);
  const [activeRadiusKm, setActiveRadiusKm] = useState(5);
  const [deviationKm, setDeviationKm] = useState(2);

  useEffect(() => {
    fetch("/api/auth/session", { cache: "no-store" })
      .then(r => r.json())
      .then(data => {
        if (!data?.user) { navigate("/auth"); return; }
        if (data.user.name) setFullName(data.user.name);
      })
      .catch(() => navigate("/auth"));
  }, []);

  const submit = async () => {
    if (!fullName.trim() || !phone.trim() || !vehicleType) return;
    setSending(true);
    try {
      const res = await fetch("/api/delivery/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName, phone, idType, idNumber, vehicleType }),
      });
      if (!res.ok) throw new Error("Registration failed");

      // Save rayon/deviation preferences
      await fetch("/api/delivery/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activeMode: "radius", activeRadiusKm, deviationKm }),
      });

      toast("Profil livreur créé !");
      navigate("/delivery/dashboard");
    } catch (err) {
      toast("Erreur lors de l'inscription");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-white">
      <div className="max-w-lg mx-auto px-4 py-8">
        <button onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6">
          <ArrowLeft size={14} className="text-white/50" />
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center">
            <Truck size={20} className="text-emerald-400" />
          </div>
          <div>
            <h1 className="text-lg font-medium">Devenir livreur</h1>
            <p className="text-white/30 text-sm">Gagne de l'argent en livrant</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex gap-2 mb-8">
          {[1, 2, 3, 4].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-all ${s <= step ? "bg-emerald-500" : "bg-white/10"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-sm text-white/60 font-medium">Informations personnelles</h2>
            <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nom complet *" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/30 outline-none" />
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Téléphone *" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/30 outline-none" />
            <div>
              <p className="text-white/40 text-xs mb-2">Pièce d'identité (optionnel)</p>
              <div className="flex gap-2">
                {["national_id", "passport", "driver_license"].map((t) => (
                  <button key={t} onClick={() => setIdType(t)}
                    className={`px-3 py-1.5 rounded-lg text-xs border transition-all ${idType === t ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-white/5 text-white/40 border-white/10"}`}
                  >
                    {{ national_id: "CNI", passport: "Passeport", driver_license: "Permis" }[t]}
                  </button>
                ))}
              </div>
            </div>
            {idType && <input value={idNumber} onChange={(e) => setIdNumber(e.target.value)} placeholder="Numéro de la pièce" className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white/70 placeholder-white/30 outline-none" />}
            <button onClick={() => setStep(2)} disabled={!fullName.trim() || !phone.trim()}
              className="w-full py-3 rounded-xl bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all disabled:opacity-30"
            >
              Suivant
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-sm text-white/60 font-medium">Moyen de livraison</h2>
            <div className="space-y-2">
              {VEHICLES.map((v) => {
                const Icon = v.icon;
                return (
                  <button key={v.type} onClick={() => setVehicleType(v.type)}
                    className={`w-full flex items-center gap-4 p-4 rounded-xl border transition-all ${vehicleType === v.type ? "bg-emerald-500/10 border-emerald-500/20" : "bg-white/[0.02] border-white/10 hover:bg-white/[0.04]"}`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${vehicleType === v.type ? "bg-emerald-500/20" : "bg-white/5"}`}>
                      <Icon size={20} className={vehicleType === v.type ? "text-emerald-400" : "text-white/40"} />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium">{v.label}</p>
                      <p className="text-xs text-white/30">{v.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => setStep(3)} disabled={!vehicleType}
              className="w-full py-3 rounded-xl bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all disabled:opacity-30"
            >
              Suivant
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-5">
            <h2 className="text-sm text-white/60 font-medium">Vérification KYC (simulée)</h2>
            <p className="text-xs text-white/30">Ces informations sont simulées pour le moment.</p>
            <KycForm
              data={{ idType, idNumber, address: kycAddress, kycUploaded: kycDocUploaded }}
              onChange={({ idType: t, idNumber: n, address: a, kycUploaded: u }) => {
                if (t !== undefined) setIdType(t);
                if (n !== undefined) setIdNumber(n);
                if (a !== undefined) setKycAddress(a);
                if (u !== undefined) setKycDocUploaded(u);
              }}
              onComplete={() => setStep(4)}
            />
          </div>
        )}

        {step === 4 && (
          <div className="space-y-5">
            <h2 className="text-sm text-white/60 font-medium">Zone de livraison</h2>
            <div>
              <label className="text-xs text-white/40 mb-2 flex items-center justify-between">
                <span>Rayon max</span>
                <span className="text-emerald-400/60">{activeRadiusKm} km</span>
              </label>
              <input type="range" min="1" max="20" step="0.5" value={activeRadiusKm}
                onChange={(e) => setActiveRadiusKm(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1"
              />
              <p className="text-[10px] text-white/20 mt-1">Les commandes dans ce rayon te seront proposées</p>
            </div>
            <div>
              <label className="text-xs text-white/40 mb-2 flex items-center justify-between">
                <span>Déviation max (trajet)</span>
                <span className="text-emerald-400/60">{deviationKm} km</span>
              </label>
              <input type="range" min="0" max="10" step="0.5" value={deviationKm}
                onChange={(e) => setDeviationKm(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 h-1"
              />
              <p className="text-[10px] text-white/20 mt-1">Disponible avec l'abonnement (1 000 FCFA/mois)</p>
            </div>
            <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
              <MapPin size={14} className="text-amber-400 shrink-0" />
              <p className="text-[10px] text-amber-400/60">En mode gratuit, tu livreras en rayon uniquement (3/jour max)</p>
            </div>
            <button onClick={submit} disabled={sending}
              className="w-full py-3 rounded-xl bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : null}
              {sending ? "Inscription..." : "Devenir livreur"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
