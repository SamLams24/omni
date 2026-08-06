"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ArrowLeft, Navigation, Plus, Trash2, MapPin, Search, Loader2 } from "lucide-react";
import { toast } from "sonner";

export default function NewTrip() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editTripId = searchParams.get("editTripId");
  const isEditing = !!editTripId;
  const mapContainer = useRef(null);
  const map = useRef(null);
  const mapInitCalled = useRef(false);
  const markers = useRef([]);
  const debounceRef = useRef(null);
  const activePinRef = useRef(null);
  const originRef = useRef(null);
  const destinationRef = useRef(null);

  const [mapLibLoaded, setMapLibLoaded] = useState(false);
  const [origin, setOrigin] = useState(null);
  const [destination, setDestination] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [deviationKm, setDeviationKm] = useState(() => {
    try {
      const raw = localStorage.getItem("delivery_prefs");
      const prefs = raw ? JSON.parse(raw) : {};
      return prefs.deviationKm || 2;
    } catch { return 2; }
  });
  const [sending, setSending] = useState(false);
  const [userLocation, setUserLocation] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [activePin, setActivePin] = useState(null);
  const [showSearch, setShowSearch] = useState(false);

  // Load MapLibre from CDN
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.maplibregl) { setMapLibLoaded(true); return; }
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/maplibre-gl@5.22.0/dist/maplibre-gl.css";
    document.head.appendChild(link);
    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.22.0/dist/maplibre-gl.js";
    script.onload = () => setMapLibLoaded(true);
    document.head.appendChild(script);
  }, []);

  // Load existing trip for editing
  useEffect(() => {
    if (!editTripId) return;
    (async () => {
      try {
        const res = await fetch(`/api/delivery/trips/${editTripId}`);
        if (res.ok) {
          const data = await res.json();
          const t = data.trip;
          setOrigin({ lat: parseFloat(t.origin_lat), lon: parseFloat(t.origin_lon), name: "Départ" });
          setDestination({ lat: parseFloat(t.destination_lat), lon: parseFloat(t.destination_lon), name: "Arrivée" });
          setWaypoints((t.waypoints || []).map((wp) => ({ lat: parseFloat(wp.lat), lon: parseFloat(wp.lon), name: wp.address || "" })));
          setDeviationKm(parseFloat(t.deviation_km) || 2);
        }
      } catch {}
    })();
  }, [editTripId]);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const loc = { lat: pos.coords.latitude, lon: pos.coords.longitude };
          setUserLocation(loc);
          setOrigin({ ...loc, name: "Ma position" });
        },
        () => {
          const fallback = { lat: 6.1319, lon: 1.2228 };
          setUserLocation(fallback);
          setOrigin({ ...fallback, name: "Ma position (fallback)" });
        },
        { timeout: 5000 }
      );
    } else {
      const fallback = { lat: 6.1319, lon: 1.2228 };
      setUserLocation(fallback);
      setOrigin({ ...fallback, name: "Ma position (fallback)" });
    }
  }, []);

  useEffect(() => { activePinRef.current = activePin; }, [activePin]);
  useEffect(() => { originRef.current = origin; }, [origin]);
  useEffect(() => { destinationRef.current = destination; }, [destination]);

  // Init map
  const initMap = useCallback(() => {
    if (!mapContainer.current || mapInitCalled.current || !window.maplibregl || !userLocation) return;
    mapInitCalled.current = true;
    const maplibregl = window.maplibregl;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {
          carto: {
            type: "raster",
            tiles: [
              "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
            ],
            tileSize: 256,
            attribution: "© OpenStreetMap, © CartoDB",
          },
        },
        layers: [
          { id: "background", type: "background", paint: { "background-color": "#050510" } },
          { id: "carto-tiles", type: "raster", source: "carto" },
        ],
      },
      center: [userLocation.lon, userLocation.lat],
      zoom: 14,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    map.current.on("click", (e) => {
      const { lng, lat } = e.lngLat;
      const ap = activePinRef.current;
      const org = originRef.current;
      const dst = destinationRef.current;
      if (ap === "origin") {
        setOrigin((prev) => ({ ...prev, lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` }));
      } else if (ap === "destination") {
        setDestination({ lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
      } else if (typeof ap === "number") {
        setWaypoints((prev) => {
          const updated = [...prev];
          updated[ap] = { lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` };
          return updated;
        });
      } else {
        if (!dst && org) {
          setDestination({ lat, lon: lng, name: `${lat.toFixed(4)}, ${lng.toFixed(4)}` });
        }
      }
      setActivePin(null);
    });

    map.current.on("load", () => {
      map.current.addSource("route", {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "LineString", coordinates: [] } },
      });
      map.current.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        paint: { "line-color": "#10b981", "line-width": 4, "line-opacity": 0.8 },
      });
    });
  }, [userLocation]);

  useEffect(() => {
    if (mapLibLoaded && userLocation && mapContainer.current) initMap();
  }, [mapLibLoaded, userLocation, initMap]);

  // Collect all points for markers and route
  const allPoints = useCallback(() => {
    const pts = [];
    if (origin) pts.push({ ...origin, type: "origin", label: "Départ" });
    waypoints.forEach((wp, i) => {
      if (wp.lat != null && wp.lon != null) pts.push({ ...wp, type: "waypoint", label: `Escale ${i + 1}`, idx: i });
    });
    if (destination) pts.push({ ...destination, type: "destination", label: "Arrivée" });
    return pts;
  }, [origin, destination, waypoints]);

  // Update markers and route when points change
  useEffect(() => {
    if (!map.current || !mapInitCalled.current || !window.maplibregl) return;
    const maplibregl = window.maplibregl;

    markers.current.forEach((m) => m.remove());
    markers.current = [];

    const pts = allPoints();
    const coords = pts.map((p) => [p.lon, p.lat]);

    pts.forEach((p) => {
      const el = document.createElement("div");
      el.style.width = "24px";
      el.style.height = "24px";
      el.style.borderRadius = "50%";
      el.style.border = "3px solid white";
      el.style.cursor = "grab";
      el.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
      el.style.backgroundColor = p.type === "origin" ? "#3b82f6" : p.type === "destination" ? "#ef4444" : "#eab308";
      el.title = p.name || p.label;
      const marker = new maplibregl.Marker({ element: el, draggable: true })
        .setLngLat([p.lon, p.lat])
        .addTo(map.current);
      marker.on("dragend", () => {
        const lngLat = marker.getLngLat();
        if (p.type === "origin") {
          setOrigin((prev) => ({ ...prev, lat: lngLat.lat, lon: lngLat.lng }));
        } else if (p.type === "destination") {
          setDestination({ lat: lngLat.lat, lon: lngLat.lng, name: p.name });
        } else if (p.type === "waypoint") {
          setWaypoints((prev) => {
            const updated = [...prev];
            updated[p.idx] = { ...updated[p.idx], lat: lngLat.lat, lon: lngLat.lng };
            return updated;
          });
        }
      });
      markers.current.push(marker);
    });

    if (coords.length >= 2) {
      const source = map.current.getSource("route");
      if (source) {
        source.setData({ type: "Feature", geometry: { type: "LineString", coordinates: coords } });
      }
      const bounds = new maplibregl.LngLatBounds();
      coords.forEach((c) => bounds.extend(c));
      map.current.fitBounds(bounds, { padding: 80, maxZoom: 15, duration: 1000 });
    }
  }, [allPoints]);

  // Nominatim search
  const searchLocation = async (query) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.map((r) => ({ name: r.display_name, lat: parseFloat(r.lat), lon: parseFloat(r.lon) })));
      }
    } catch (err) { console.error("Nominatim search error:", err); } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchLocation(val), 200);
  };

  const selectSearchResult = (result) => {
    setSearchQuery("");
    setSearchResults([]);
    setShowSearch(false);
    const point = { lat: result.lat, lon: result.lon, name: result.name };

    if (activePin === "origin" || (!origin)) {
      setOrigin(point);
    } else if (activePin === "destination" || (origin && !destination)) {
      setDestination(point);
    } else if (typeof activePin === "number") {
      setWaypoints((prev) => {
        const updated = [...prev];
        updated[activePin] = point;
        return updated;
      });
    } else {
      if (!origin) setOrigin(point);
      else if (!destination) setDestination(point);
      else {
        setWaypoints((prev) => [...prev, point]);
      }
    }
    setActivePin(null);

    if (map.current) {
      map.current.flyTo({ center: [result.lon, result.lat], zoom: 15, duration: 1000 });
    }
  };

  const addWaypoint = () => {
    if (waypoints.length >= 5) { toast("Maximum 5 escales"); return; }
    const idx = waypoints.length;
    setWaypoints((prev) => [...prev, { lat: null, lon: null, name: "" }]);
    setActivePin(idx);
    toast("Clique sur la carte ou cherche une adresse");
  };

  const removeWaypoint = (i) => {
    setWaypoints((prev) => prev.filter((_, idx) => idx !== i));
  };

  const submit = async () => {
    if (!origin?.lat || !destination?.lat) { toast("Départ et arrivée requis"); return; }
    setSending(true);
    try {
      try {
        const { authFetch } = await import("@/lib/auth-client");
        const authRes = await authFetch("/api/auth/session");
        const authData = await authRes.json();
        if (!authData?.user) { toast("Session expirée"); navigate("/auth"); return; }
      } catch {
        toast("Session expirée");
        navigate("/auth");
        return;
      }
      const wps = waypoints.filter((w) => w.lat != null && w.lon != null).map((w) => ({
        lat: w.lat, lon: w.lon, address: w.name || "",
      }));
      const url = isEditing ? `/api/delivery/trips/${editTripId}` : "/api/delivery/trips/create";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originLat: origin.lat,
          originLon: origin.lon,
          destinationLat: destination.lat,
          destinationLon: destination.lon,
          waypoints: wps,
          deviationKm,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      toast(isEditing ? "Trajet modifié !" : "Trajet créé !");
      navigate("/delivery/dashboard");
    } catch (err) {
      toast("Erreur lors de la création du trajet");
    } finally {
      setSending(false);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      markers.current.forEach((m) => m.remove());
      if (map.current) { map.current.remove(); map.current = null; }
      mapInitCalled.current = false;
    };
  }, []);

  const colorFor = (type) => {
    if (type === "origin") return { dot: "bg-blue-400", text: "text-blue-300" };
    if (type === "destination") return { dot: "bg-red-400", text: "text-red-300" };
    return { dot: "bg-yellow-400", text: "text-yellow-300" };
  };

  const renderPinItem = (label, point, type, index) => {
    const c = colorFor(type);
    return (
      <div
        key={`${type}-${index}`}
        onClick={() => {
          setActivePin(type === "waypoint" ? index : type);
          setShowSearch(true);
          toast(`Clique sur la carte ou cherche pour ${label.toLowerCase()}`);
        }}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
          activePin === (type === "waypoint" ? index : type)
            ? "bg-emerald-500/10 border border-emerald-500/20"
            : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06]"
        }`}
      >
        <div className={`w-2.5 h-2.5 rounded-full ${c.dot} shrink-0`} />
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-medium ${c.text}`}>{label}</p>
          <p className="text-white/30 text-[10px] truncate">{point?.name || "Clique sur la carte"}</p>
        </div>
        {type === "waypoint" && (
          <button onClick={(e) => { e.stopPropagation(); removeWaypoint(index); }} className="text-red-400/40 hover:text-red-400 p-1">
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen w-full relative bg-neutral-950 overflow-hidden">
      {/* Map */}
      <div ref={mapContainer} className="absolute inset-0" style={{ width: "100%", height: "100%" }} />

      {/* Top bar */}
      <div className="absolute top-4 left-4 z-10">
        <button onClick={() => navigate(-1)} className="w-9 h-9 rounded-full bg-black/50 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/70 transition-all">
          <ArrowLeft size={16} className="text-white/70" />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="absolute top-4 left-16 right-4 z-10">
          <div className="bg-black/70 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            <div className="flex items-center px-4 py-3 gap-3">
              <Search size={16} className="text-white/40 shrink-0" />
              <input
                autoFocus
                type="text"
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                placeholder="Rechercher un lieu..."
                className="flex-1 bg-transparent text-white/90 text-sm outline-none placeholder-white/30"
              />
              {searching && <Loader2 size={14} className="animate-spin text-white/30" />}
              <button onClick={() => { setShowSearch(false); setSearchQuery(""); setSearchResults([]); }} className="text-white/30 hover:text-white/60 text-xs shrink-0">
                Fermer
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="border-t border-white/10 max-h-48 overflow-y-auto">
                {searchResults.map((r, i) => (
                  <button key={i} onClick={() => selectSearchResult(r)}
                    className="w-full text-left px-4 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-all border-b border-white/5 last:border-0 flex items-start gap-2"
                  >
                    <MapPin size={12} className="text-emerald-400 shrink-0 mt-0.5" />
                    <span>{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom sheet */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-neutral-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 shadow-2xl max-h-[45vh] overflow-y-auto">
        <div className="p-4 pb-6 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Navigation size={16} className="text-emerald-400" />
              <h2 className="text-white text-sm font-medium">{isEditing ? "Modifier le trajet" : "Nouveau trajet"}</h2>
            </div>
            <button
              onClick={() => setShowSearch(!showSearch)}
              className="text-[10px] px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 transition-all"
            >
              {showSearch ? "Cacher" : "Rechercher"}
            </button>
          </div>

          {renderPinItem("Départ", origin, "origin", 0)}

          {waypoints.map((wp, i) => renderPinItem(`Escale ${i + 1}`, wp, "waypoint", i))}

          {waypoints.length < 5 && (
            <button onClick={addWaypoint}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-white/10 text-white/30 text-xs hover:border-white/20 hover:text-white/50 transition-all"
            >
              <Plus size={14} /> Ajouter une escale
            </button>
          )}

          {renderPinItem("Arrivée", destination, "destination", 0)}

          <div>
            <label className="text-[10px] text-white/40 mb-1 flex items-center justify-between">
              <span>Déviation max</span>
              <span className="text-emerald-400/60">{deviationKm} km</span>
            </label>
            <input type="range" min="0" max="10" step="0.5" value={deviationKm}
              onChange={(e) => setDeviationKm(parseFloat(e.target.value))}
              className="w-full accent-emerald-500 h-1"
            />
          </div>

          <button onClick={submit} disabled={sending || !origin?.lat || !destination?.lat}
            className="w-full py-3 rounded-xl bg-emerald-500 text-black font-medium text-sm hover:bg-emerald-400 transition-all disabled:opacity-30 flex items-center justify-center gap-2"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : null}
            {sending ? (isEditing ? "Modification..." : "Création...") : (isEditing ? "Enregistrer" : "Activer ce trajet")}
          </button>
        </div>
      </div>

      <style>{`
        .maplibregl-control-container { display: none !important; }
        input[type="range"] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; outline: none; }
        input[type="range"]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 16px; height: 16px; border-radius: 50%; background: #10b981; cursor: pointer; border: 2px solid white; }
      `}</style>
    </div>
  );
}
