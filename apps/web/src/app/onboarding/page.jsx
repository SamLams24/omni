"use client";

import { useState } from "react";
import { useNavigate } from "react-router";
import { Map, Store, Truck, ChevronRight, Navigation } from "lucide-react";

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");

  useEffect(() => {
    const checkSession = async () => {
      const { authFetch } = await import("@/lib/auth-client");
      try {
        const r = await authFetch("/api/auth/session");
        const data = await r.json();
        if (data?.user?.name) setName(data.user.name);
      } catch {}
    };
    checkSession();
  }, []);

  const finish = (role) => {
    localStorage.setItem("onboarding_done", "true");
    if (role === "vendor") navigate("/vendor/onboarding");
    else if (role === "delivery") navigate("/delivery/onboarding");
    else navigate("/map");
  };

  const handleLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {}
      );
    }
    setStep(2);
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        {step === 1 && (
          <div className="text-center animate-fade-in">
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
              <Map size={28} className="text-emerald-400" />
            </div>
            <h1 className="text-2xl font-medium text-white mb-2">Bienvenue sur Omni</h1>
            <p className="text-white/40 text-sm mb-8">Ta marketplace de quartier</p>

            <div className="space-y-4">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ton prénom"
                  className="w-full bg-transparent text-white text-sm outline-none placeholder-white/30"
                />
              </div>

              <button onClick={handleLocation}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border border-white/10 text-white/60 hover:text-white hover:bg-white/5 transition-all text-sm"
              >
                <Navigation size={16} className="text-emerald-400" />
                Activer ma position
              </button>

              <button onClick={() => setStep(2)}
                className="w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm transition-all flex items-center justify-center gap-2"
              >
                Continuer <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-in">
            <h2 className="text-xl font-medium text-white text-center mb-2">Choisis ton rôle</h2>
            <p className="text-white/40 text-sm text-center mb-8">Pour commencer, dis-nous ce que tu veux faire</p>

            <div className="space-y-3">
              {[
                { role: "buyer", label: "Acheteur", desc: "Découvre des vendeurs près de chez toi", icon: Map, color: "text-emerald-400", border: "border-emerald-500/20" },
                { role: "vendor", label: "Vendeur", desc: "Crée ta boutique et vends tes produits", icon: Store, color: "text-blue-400", border: "border-blue-500/20" },
                { role: "delivery", label: "Livreur", desc: "Gagne de l'argent en livrant", icon: Truck, color: "text-purple-400", border: "border-purple-500/20" },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <button key={r.role} onClick={() => finish(r.role)}
                    className={`w-full flex items-center gap-4 px-4 py-4 rounded-xl border ${r.border} bg-white/[0.02] hover:bg-white/[0.05] transition-all text-left`}
                  >
                    <div className={`w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center ${r.color}`}>
                      <Icon size={20} />
                    </div>
                    <div className="flex-1">
                      <p className="text-white text-sm font-medium">{r.label}</p>
                      <p className="text-white/30 text-xs mt-0.5">{r.desc}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <style>{`
          @keyframes fade-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .animate-fade-in { animation: fade-in 0.3s ease-out; }
        `}</style>
      </div>
    </div>
  );
}
