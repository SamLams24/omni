import { useState, useEffect } from "react";
import { MapPin, Loader2 } from "lucide-react";

export default function ProximityPanel({ lat, lon, maxItems = 5 }) {
  const [entities, setEntities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setEntities([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const query = new URLSearchParams({
          lat: String(lat),
          lon: String(lon),
        });
        const res = await fetch(`/api/proximity/nearby?${query}`);
        if (res.ok) {
          const data = await res.json();
          setEntities(data.entities || []);
        }
      } catch {} finally {
        setLoading(false);
      }
    })();
  }, [lat, lon]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Loader2 size={14} className="animate-spin text-white/30" />
      </div>
    );
  }

  if (entities.length === 0) {
    return (
      <div className="text-center py-4">
        <MapPin size={20} className="mx-auto text-white/20 mb-1" />
        <p className="text-[10px] text-white/20">Aucune entité à proximité</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entities.slice(0, maxItems).map((e, i) => (
        <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin size={10} className="text-emerald-400 shrink-0" />
            <span className="text-xs text-white/60 truncate">{e.name || `Entité #${i + 1}`}</span>
          </div>
          <span className="text-[10px] text-white/30 shrink-0 ml-2">
            {e.distance_meters ? `${Math.round(e.distance_meters)}m` : "—"}
          </span>
        </div>
      ))}
    </div>
  );
}
