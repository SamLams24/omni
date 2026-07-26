"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Search, MapPin, X, Navigation, Mic, Loader2, ArrowLeft, ChevronRight, Plus, Minus, MessageCircle, ShoppingBag, Utensils, Wrench, Truck, Shirt, Home, Store, Star, ArrowUpDown } from "lucide-react";
import { toast } from "sonner";
import ImageSearch from "@/components/ImageSearch";
import ChatModal from "@/components/ChatModal";
import NotificationBell from "@/components/NotificationBell";
import FavoriteButton from "@/components/FavoriteButton";
import CartBadge from "@/components/CartBadge";
import CartPanel from "@/components/CartPanel";
import ReviewForm from "@/components/ReviewForm";
import ReviewList from "@/components/ReviewList";
import MobileNav from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/useIsMobile";

export default function MapPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecking, setAuthChecking] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [sortBy, setSortBy] = useState("distance");
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [quantity, setQuantity] = useState(1);
  const [chatRequest, setChatRequest] = useState(null);
  const [showVendorChat, setShowVendorChat] = useState(false);
  const [hasVendor, setHasVendor] = useState(false);
  const mapContainer = useRef(null);
  const map = useRef(null);
  const userMarker = useRef(null);
  const vendorMarkers = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapLibLoaded, setMapLibLoaded] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [manualLocationMode, setManualLocationMode] = useState(false);
  const [manualLat, setManualLat] = useState('');
  const [manualLon, setManualLon] = useState('');
  const [locationLoading, setLocationLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [cachedVendors, setCachedVendors] = useState([]);
  const [mapLoading, setMapLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [currentZoom, setCurrentZoom] = useState(14);
  const [routeSteps, setRouteSteps] = useState(null);
  const [showRoute, setShowRoute] = useState(false);
  const [announcedSteps, setAnnouncedSteps] = useState(new Set());
  const isMobile = useIsMobile();
  const watchIdRef = useRef(null);
  const [showCart, setShowCart] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const [showReviews, setShowReviews] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [walletBalance, setWalletBalance] = useState(null);
  const [showSortPicker, setShowSortPicker] = useState(false);
  const [facilitySuggestions, setFacilitySuggestions] = useState([]);
  const facilityDebounceRef = useRef(null);
  const [highlightedFacilityId, setHighlightedFacilityId] = useState(null);

  // Load cart count on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem("omni_cart");
      const cart = raw ? JSON.parse(raw) : { items: [] };
      setCartItemCount(cart.items.length);
    } catch {
      setCartItemCount(0);
    }
  }, []);

  const sortedVendors = useMemo(() => {
    const sorted = [...vendors];
    if (sortBy === "price") {
      sorted.sort((a, b) => (a.avg_price || 0) - (b.avg_price || 0));
    } else if (sortBy === "rating") {
      sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === "best_value") {
      sorted.sort((a, b) => {
        const va = (a.rating || 0) * (a.review_count || 1) / (a.distance || 1);
        const vb = (b.rating || 0) * (b.review_count || 1) / (b.distance || 1);
        return vb - va;
      });
    } else {
      sorted.sort((a, b) => (a.distance || 0) - (b.distance || 0));
    }
    return sorted;
  }, [vendors, sortBy]);

  const addToCart = (product, facilityId, facilityName, vendorName, vendorId) => {
    try {
      const raw = localStorage.getItem("omni_cart");
      const cart = raw ? JSON.parse(raw) : { items: [] };

      // Check if item already in cart
      const existingIdx = cart.items.findIndex(
        (item) => item.productId === product.id && item.facilityId === facilityId
      );

      if (existingIdx >= 0) {
        cart.items[existingIdx].quantity += 1;
      } else {
        cart.items.push({
          _localId: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          productId: product.id,
          productName: product.name,
          price: product.price,
          unit: product.unit || "pièce",
          quantity: 1,
          facilityId,
          facilityName,
          vendorName,
          vendorId,
        });
      }

      localStorage.setItem("omni_cart", JSON.stringify(cart));
      setCartItemCount(cart.items.length);
      toast(`"${product.name}" ajouté au panier`);
    } catch (err) {
      console.error("Cart error:", err);
      toast("Erreur lors de l'ajout au panier");
    }
  };

  const loadReviews = async (facilityId) => {
    setReviewsLoading(true);
    try {
      const res = await fetch(`/api/reviews/facility/${facilityId}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch {} finally {
      setReviewsLoading(false);
    }
  };

  // Auth check — allows guest browsing, no hard redirect
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch("/api/auth/session");
        const data = await response.json();
        if (data?.user) {
          localStorage.setItem("omni_user", JSON.stringify(data.user));
          setIsAuthenticated(true);
        }
      } catch (error) {
        console.error("Auth check failed:", error);
      } finally {
        setAuthChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Check if user also has a vendor profile
  useEffect(() => {
    if (!isAuthenticated) return;
    const checkVendor = async () => {
      try {
        const res = await fetch("/api/vendors/my-vendor");
        if (res.ok) {
          const data = await res.json();
          setHasVendor(!!data.vendor);
        }
      } catch (e) {
        // Not a vendor, no problem
      }
    };
    checkVendor();
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    const fetchBalance = async () => {
      try {
        const res = await fetch("/api/wallet/balance");
        if (res.ok) { const d = await res.json(); setWalletBalance(d.balance); }
      } catch {}
    };
    fetchBalance();
  }, [isAuthenticated]);

  // Location handlers
  const retryLocation = () => {
    setLocationLoading(true);
    setLocationError(null);
    setShowLocationPrompt(false);
    setManualLocationMode(false);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log('[Map] Got user location:', position.coords.latitude, position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          });
          setLocationError(null);
          setLocationLoading(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setLocationLoading(false);
          if (error.code === error.PERMISSION_DENIED) {
            setLocationError('Localisation désactivée. Activez-la pour trouver les vendeurs près de chez vous.');
          } else {
            setLocationError('Impossible d\'obtenir votre position.');
          }
          setShowLocationPrompt(true);
        },
        { timeout: 10000, maximumAge: 60000 }
      );
    } else {
      setLocationLoading(false);
      setLocationError('La géolocalisation n\'est pas supportée par votre navigateur.');
      setShowLocationPrompt(true);
    }
  };

  const useDefaultLocation = () => {
    console.log('[Map] Using default location: Lagos');
    setUserLocation({ lat: 6.1319, lon: 1.2228 });
    setLocationError(null);
    setShowLocationPrompt(false);
    setManualLocationMode(false);
  };

  const submitManualLocation = () => {
    const lat = parseFloat(manualLat);
    const lon = parseFloat(manualLon);
    if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      toast("Coordonnées invalides");
      return;
    }
    console.log('[Map] Using manual location:', lat, lon);
    setUserLocation({ lat, lon });
    setLocationError(null);
    setShowLocationPrompt(false);
    setManualLocationMode(false);
  };

  // Get user location
  useEffect(() => {
    retryLocation();
  }, []);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => {
      setIsOffline(true);
      if (vendors.length > 0) {
        setCachedVendors(vendors);
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOffline(!navigator.onLine);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [vendors]);
  // Load MapLibre GL
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    if (window.maplibregl) {
      setMapLibLoaded(true);
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/maplibre-gl@5.22.0/dist/maplibre-gl.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/maplibre-gl@5.22.0/dist/maplibre-gl.js";
    script.onload = () => {
      console.log("MapLibre GL loaded");
      setMapLibLoaded(true);
    };
    document.head.appendChild(script);
  }, []);

  // Map initialization ref — runs once via callback ref when container mounts
  const mapInitCalled = useRef(false);
  const initMap = useCallback((container) => {
    if (mapInitCalled.current || !container || !window.maplibregl || !userLocation) return;
    mapInitCalled.current = true;

    console.log('[Map] Starting map initialization...');

    try {
      const maplibregl = window.maplibregl;

      map.current = new maplibregl.Map({
        container,
        style: {
          version: 8,
          projection: { type: "globe" },
          glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
          sources: {
            carto: {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png"
              ],
              tileSize: 256,
              attribution: '© OpenStreetMap, © CartoDB',
              minzoom: 0,
              maxzoom: 22
            },
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: '© OpenStreetMap',
              minzoom: 0,
              maxzoom: 19
            }
          },
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#050510" }
            },
            {
              id: "carto-tiles",
              type: "raster",
              source: "carto",
              paint: {
                "raster-opacity": 1,
                "raster-brightness-min": 0.2,
                "raster-brightness-max": 1.0
              }
            },
            {
              id: "osm-fallback",
              type: "raster",
              source: "osm",
              layout: { "visibility": "none" },
              paint: { "raster-opacity": 1 }
            }
          ],
          sky: {
            "atmosphere-blend": [
              "interpolate", ["linear"], ["zoom"],
              0, 1, 5, 0.9, 12, 0
            ]
          }
        },
        center: [userLocation.lon, userLocation.lat],
        zoom: 14,
        pitch: 45,
        bearing: 0,
        maxZoom: 19,
        minZoom: 0,
        renderWorldCopies: false
      });

      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
      map.current.addControl(new maplibregl.FullscreenControl(), "top-right");

      const userEl = document.createElement("div");
      userEl.style.width = "20px";
      userEl.style.height = "20px";
      userEl.style.borderRadius = "50%";
      userEl.style.backgroundColor = "#3b82f6";
      userEl.style.border = "3px solid white";
      userEl.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";

      userMarker.current = new maplibregl.Marker({ element: userEl })
        .setLngLat([userLocation.lon, userLocation.lat])
        .addTo(map.current);

      map.current.on("load", () => {
        console.log("Map loaded successfully");
        setMapReady(true);
        setMapLoading(false);
        setCurrentZoom(map.current.getZoom());
      });

      map.current.on("zoom", () => {
        setCurrentZoom(map.current.getZoom());
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
        setError("Erreur de chargement de la carte");
      });

      map.current.on("styleimagemissing", (e) => {
        console.warn("Missing image:", e);
      });

    } catch (err) {
      console.error("Error initializing map:", err);
      setError("Erreur lors de l'initialisation de la carte");
    }
  }, [userLocation]);

  // Trigger init once MapLibre loads
  useEffect(() => {
    if (mapLibLoaded && mapContainer.current) {
      initMap(mapContainer.current);
    }
  }, [mapLibLoaded, initMap]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      vendorMarkers.current.forEach(m => m.remove());
      vendorMarkers.current = [];
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
      mapInitCalled.current = false;
    };
  }, []);

  // Load nearby vendors when user location is available
  useEffect(() => {
    if (userLocation) {
      loadNearbyVendors();
    }
  }, [userLocation]);

  // Update vendor markers when vendors change - with viewport clustering/filtering
  useEffect(() => {
    if (!map.current || !mapReady || !window.maplibregl) return;

    // Get current map bounds for viewport filtering
    let visibleVendors = sortedVendors;
    if (map.current.getBounds) {
      const bounds = map.current.getBounds();
      const currentZoom = map.current.getZoom();
      
      // At high zoom (15+), show all markers in view
      // At low zoom, filter to show only clustered markers by viewport
      if (currentZoom < 12 && vendors.length > 20) {
        // Filter vendors to those within viewport bounds + buffer
        visibleVendors = vendors.filter(vendor => {
          if (!vendor.lon || !vendor.lat) return false;
          const lng = Number(vendor.lon);
          const lat = Number(vendor.lat);
          return bounds.contains([lng, lat]);
        });
        
        // If no vendors in view, show nearest ones
        if (visibleVendors.length === 0) {
          const center = map.current.getCenter();
          visibleVendors = [...vendors]
            .sort((a, b) => {
              const distA = Math.sqrt(Math.pow(a.lat - center.lat, 2) + Math.pow(a.lon - center.lng, 2));
              const distB = Math.sqrt(Math.pow(b.lat - center.lat, 2) + Math.pow(b.lon - center.lng, 2));
              return distA - distB;
            })
            .slice(0, 15);
        }
        console.log('[Map] Viewport filtered vendors:', visibleVendors.length, 'of', vendors.length);
      }
    }

    // Remove old markers
    vendorMarkers.current.forEach((marker) => marker.remove());
    vendorMarkers.current = [];

    // Add new markers with premium styling
    visibleVendors.forEach((vendor) => {
      const el = document.createElement("div");
      el.className = "vendor-marker";
      el.style.width = "36px";
      el.style.height = "36px";
      el.style.borderRadius = "50%";
      const isOnline = vendor.is_online !== undefined ? vendor.is_online : true;
      el.style.backgroundColor = isOnline ? "rgba(16, 185, 129, 0.9)" : "rgba(107, 114, 128, 0.9)";
      el.style.border = "2px solid rgba(255, 255, 255, 0.8)";
      el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px rgba(16, 185, 129, 0.2)";
      el.style.cursor = "pointer";
      el.style.display = "flex";
      el.style.alignItems = "center";
      el.style.justifyContent = "center";
      el.style.transition = "box-shadow 0.2s ease";

      // Mobile icon or inner dot based on type
      if (vendor.type === 'mobile') {
        const icon = document.createElement("span");
        icon.textContent = '🛵';
        icon.style.fontSize = '16px';
        el.appendChild(icon);
      } else {
        const dot = document.createElement("div");
        dot.style.width = "12px";
        dot.style.height = "12px";
        dot.style.borderRadius = "50%";
        dot.style.backgroundColor = "white";
        dot.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)";
        el.appendChild(dot);
      }
      
      // Hover effect
      el.addEventListener("mouseenter", () => {
        el.style.boxShadow = "0 6px 20px rgba(0,0,0,0.5), 0 0 0 6px rgba(16, 185, 129, 0.3)";
      });
      el.addEventListener("mouseleave", () => {
        el.style.boxShadow = "0 4px 12px rgba(0,0,0,0.4), 0 0 0 4px rgba(16, 185, 129, 0.2)";
      });

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        console.log('[Map] Facility clicked:', vendor.id, 'at', vendor.lon, vendor.lat);
        handleVendorClick(vendor);
      });

      const marker = new window.maplibregl.Marker({ element: el, anchor: "center" })
        .setLngLat([vendor.lon, vendor.lat])
        .addTo(map.current);

      vendorMarkers.current.push(marker);

      if (highlightedFacilityId && vendor.id !== highlightedFacilityId) {
        el.style.opacity = "0.3";
        el.style.transform = "scale(0.7)";
      }
    });
  }, [sortedVendors, mapReady, highlightedFacilityId]);

  const loadNearbyVendors = async () => {
    // If offline, use cached vendors
    if (isOffline && cachedVendors.length > 0) {
      console.log('[Map] Using cached vendors (offline)');
      setVendors(cachedVendors);
      return;
    }
    if (!userLocation) return;

    setLoading(true);
    setError(null);

    try {
      console.log('[Map] Loading nearby facilities for location:', userLocation);
      const response = await fetch("/api/facilities/nearby", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: userLocation.lat,
          lon: userLocation.lon,
          radius: 10000,
        }),
      });

      console.log('[Map] API response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Map] API error response:', errorText);
        throw new Error(`Failed to load facilities: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log('[Map] Received facilities:', data.facilities?.length || 0, data);
      setVendors(data.facilities || []);
    } catch (err) {
      console.error('[Map] Error loading facilities:', err);
      setError(`Impossible de charger les vendeurs: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (e) => {
    e?.preventDefault();
    if (!searchQuery.trim() || !userLocation) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/facilities/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lat: userLocation.lat,
          lon: userLocation.lon,
          search: searchQuery,
          radius: 5000,
        }),
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("[Search] API error:", errBody);
        throw new Error(errBody || "Search failed");
      }

      const data = await response.json();
      setVendors(data.facilities || []);

      if (data.facilities.length === 0) {
        setError("Aucun vendeur trouvé pour cette recherche");
      }
    } catch (err) {
      console.error(err);
      setError("Erreur lors de la recherche");
    } finally {
      setLoading(false);
    }
  };

  const handleVoiceSearch = () => {
    if (
      !("webkitSpeechRecognition" in window) &&
      !("SpeechRecognition" in window)
    ) {
      toast("La recherche vocale n'est pas supportée sur ce navigateur");
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = "fr-FR";
    recognition.continuous = false;

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setTimeout(() => handleSearch(), 100);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      toast("Erreur de reconnaissance vocale");
    };

    recognition.start();
  };

  const handleFacilitySearch = (query) => {
    clearTimeout(facilityDebounceRef.current);
    if (!query.trim()) { setFacilitySuggestions([]); return; }
    facilityDebounceRef.current = setTimeout(() => {
      const q = query.toLowerCase();
      const filtered = sortedVendors.filter(
        (v) =>
          (v.facility_name || v.name || "").toLowerCase().includes(q) ||
          (v.category || "").toLowerCase().includes(q)
      );
      setFacilitySuggestions(filtered.slice(0, 8));
    }, 200);
  };

  const selectFacility = (vendor) => {
    setSearchQuery(vendor.facility_name || vendor.name || "");
    setFacilitySuggestions([]);
    setHighlightedFacilityId(vendor.id);
    if (map.current) {
      map.current.flyTo({ center: [vendor.lon, vendor.lat], zoom: 16, duration: 1000 });
    }
    setSelectedVendor(vendor);
  };

  const handleVendorClick = async (vendor) => {
    setLoading(true);
    try {
      const apiPath = vendor.facility_name ? `/api/facilities/${vendor.id}` : `/api/vendors/${vendor.id}`;
      const response = await fetch(apiPath);
      if (!response.ok) throw new Error("Failed to load details");

      const data = await response.json();
      const detail = data.facility || data.vendor;
      setSelectedVendor({
        ...vendor,
        ...detail,
        id: vendor.id,
      });

      // Fly to vendor location
      if (map.current && vendor.lon && vendor.lat) {
        const lon = Number(vendor.lon);
        const lat = Number(vendor.lat);
        const currentCenter = map.current.getCenter();
        console.log('[Map] Current center:', currentCenter.lng, currentCenter.lat);
        console.log('[Map] Target location:', lon, lat);
        console.log('[Map] Map loaded:', map.current.loaded(), 'Style loaded:', map.current.isStyleLoaded());
        
        // Ensure valid coordinates
        if (!isNaN(lon) && !isNaN(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90) {
          console.log('[Map] Flying to:', [lon, lat]);
          map.current.flyTo({
            center: [lon, lat],
            zoom: 16,
            pitch: 45,
            duration: 1500,
          });
        } else {
          console.error('[Map] Invalid coordinate values:', lon, lat);
        }
      } else {
        console.error('[Map] Missing vendor coordinates:', vendor);
      }
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les détails du vendeur");
    } finally {
      setLoading(false);
    }
  };

  const requestAvailability = async (productId) => {
    if (!isAuthenticated) {
      window.location.href = "/auth";
      return;
    }
    try {
      const response = await fetch("/api/availability/request", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          vendorId: selectedVendor.vendor_id || selectedVendor.id,
          facilityId: selectedVendor.id,
          productId,
          quantity,
        }),
      });

      if (!response.ok) throw new Error("Request failed");

      const data = await response.json();

      // Open chat modal with the request
      setChatRequest(data.request);
    } catch (err) {
      console.error(err);
      toast("Erreur lors de l'envoi de la demande");
    }
  };

  const navigateToVendor = async () => {
    if (!selectedVendor || !userLocation) return;
    
    setLoading(true);
    try {
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/foot/${userLocation.lon},${userLocation.lat};${selectedVendor.lon},${selectedVendor.lat}?overview=full&steps=true&geometries=geojson`
      );
      
      if (!response.ok) throw new Error("Routing failed");
      
      const data = await response.json();
      const route = data.routes[0];
      
      if (map.current) {
        if (map.current.getSource('route')) {
          map.current.removeLayer('route-layer');
          map.current.removeSource('route');
        }
        
        map.current.addSource('route', {
          type: 'geojson',
          data: { type: 'Feature', geometry: route.geometry }
        });
        
        map.current.addLayer({
          id: 'route-layer',
          type: 'line',
          source: 'route',
          paint: { 'line-color': '#10b981', 'line-width': 4, 'line-opacity': 0.8 }
        });
        
        // Store route steps with locations for real-time voice guidance
        const steps = route.legs[0]?.steps || [];
        setRouteSteps(steps.map((s, i) => ({
          instruction: s.maneuver?.instruction || s.name,
          distance: s.distance,
          duration: s.duration,
          location: s.maneuver?.location || null, // [lon, lat]
        })));
        setAnnouncedSteps(new Set());
        setShowRoute(true);
        
        const distanceKm = (route.distance / 1000).toFixed(1);
        const durationMin = Math.round(route.duration / 60);
        toast(`Itinéraire: ${distanceKm} km · ${durationMin} min à pied`);
      }
    } catch (err) {
      console.error(err);
      toast("Itinéraire non disponible pour le moment");
    } finally {
      setLoading(false);
    }
  };

  // Real-time voice guidance
  useEffect(() => {
    if (!showRoute || !routeSteps || routeSteps.length === 0) {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      return;
    }

    const speak = (text) => {
      if (!('speechSynthesis' in window)) return;
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = 'fr-FR';
      utter.rate = 0.9;
      window.speechSynthesis.speak(utter);
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const userLat = pos.coords.latitude;
        const userLon = pos.coords.longitude;

        setRouteSteps(prev => {
          if (!prev) return prev;
          const updated = [...prev];
          let changed = false;

          updated.forEach((step, i) => {
            if (!step.location || announcedSteps.has(i)) return;
            const [stepLon, stepLat] = step.location;
            const R = 6371000;
            const dLat = (stepLat - userLat) * Math.PI / 180;
            const dLon = (stepLon - userLon) * Math.PI / 180;
            const a = Math.sin(dLat/2)**2 + Math.cos(userLat*Math.PI/180) * Math.cos(stepLat*Math.PI/180) * Math.sin(dLon/2)**2;
            const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

            if (dist < 40) {
              speak(step.instruction.toLowerCase().startsWith('destination') 
                ? `Vous êtes arrivé à destination. ${step.instruction}`
                : `Dans ${Math.round(dist)} mètres, ${step.instruction.toLowerCase()}`
              );
              setAnnouncedSteps(prev => new Set([...prev, i]));
              changed = true;
            }
          });

          return changed ? updated : prev;
        });
      },
      (err) => console.warn('Position watch error:', err),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [showRoute, routeSteps, announcedSteps]);

  const openVendorChat = () => {
    setShowVendorChat(true);
  };

  if (authChecking || (!userLocation && !showLocationPrompt)) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950">
        <div className="text-center">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
          <p className="text-white/60 text-sm font-light tracking-wide">
            {authChecking ? "Vérification..." : "Localisation..."}
          </p>
        </div>
      </div>
    );
  }

  if (!userLocation && showLocationPrompt) {
    return (
      <div className="h-screen flex items-center justify-center bg-neutral-950 p-6">
        <div className="w-full max-w-sm text-center">
          <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-6 border border-amber-500/20">
            <MapPin size={28} className="text-amber-400" />
          </div>
          {manualLocationMode ? (
            <>
              <h3 className="text-white text-base font-medium mb-2">Saisir vos coordonnées</h3>
              <p className="text-white/40 text-xs mb-5">Entrez votre latitude et longitude</p>
              <div className="flex gap-3 mb-5">
                <input
                  type="text"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  placeholder="Latitude (ex: 6.1319)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs placeholder-white/30 outline-none focus:border-emerald-500/40 transition-colors"
                />
                <input
                  type="text"
                  value={manualLon}
                  onChange={(e) => setManualLon(e.target.value)}
                  placeholder="Longitude (ex: 1.2228)"
                  className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-white text-xs placeholder-white/30 outline-none focus:border-emerald-500/40 transition-colors"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setManualLocationMode(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm transition-all"
                >
                  Retour
                </button>
                <button
                  onClick={submitManualLocation}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium transition-all"
                >
                  Valider
                </button>
              </div>
            </>
          ) : (
            <>
              <h3 className="text-white text-base font-medium mb-2">Activez votre localisation</h3>
              <p className="text-white/40 text-xs mb-2">{locationError || "Pour trouver les vendeurs près de chez vous"}</p>
              <p className="text-white/20 text-[10px] mb-6">Vous pouvez aussi saisir vos coordonnées manuellement ou utiliser une position par défaut.</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={retryLocation}
                  className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black text-sm font-medium transition-all"
                >
                  Réessayer
                </button>
                <button
                  onClick={() => setManualLocationMode(true)}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 text-sm transition-all"
                >
                  Saisir les coordonnées
                </button>
                <button
                  onClick={useDefaultLocation}
                  className="w-full py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 text-xs transition-all"
                >
                  Utiliser la position par défaut (Lagos)
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  const categories = ["Alimentation", "Services", "Artisanat", "Mode", "Maison", "Transport"];
  const categorySuggestions = searchQuery.trim()
    ? categories.filter(c => c.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  return (
    <div className="h-screen w-full relative bg-neutral-950 overflow-hidden">
      {/* Map Loading Skeleton */}
      {mapLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-neutral-950">
          <div className="text-center">
            <div className="w-20 h-20 mx-auto mb-6 relative">
              <div className="absolute inset-0 border border-white/10 rounded-full" />
              <div className="absolute inset-0 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
            <p className="text-white/60 text-sm font-light tracking-wide">Chargement de la carte...</p>
          </div>
        </div>
      )}

      {!mapReady && !mapLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-neutral-950">
          <div className="text-center">
            <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-6" />
            <p className="text-white/60 text-sm font-light tracking-wide">Chargement...</p>
          </div>
        </div>
      )}

      {/* Back Button - Minimal */}
      <a href="/" className={`absolute ${isMobile ? "top-4 left-4" : "top-6 left-6"} z-20`}>
        <button className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all duration-300 group">
          <ArrowLeft size={18} className="text-white/70 group-hover:text-white transition-colors" />
        </button>
      </a>

      {/* Search Section — Unified */}
      <div className={`absolute ${isMobile ? "top-16" : "top-6"} left-1/2 -translate-x-1/2 z-20 w-full max-w-lg px-4`}>
        <div className="relative">
          <div className="flex items-center bg-black/60 backdrop-blur-xl rounded-2xl border border-white/10 px-4 py-3.5 shadow-2xl shadow-black/50">
            <Search size={16} className="text-white/40 shrink-0 mr-2 cursor-pointer" onClick={handleSearch} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                handleFacilitySearch(e.target.value);
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch(); } }}
              placeholder="Chercher un produit, vendeur..."
              className="flex-1 bg-transparent text-white/90 placeholder-white/40 text-sm outline-none font-light"
            />
            <button
              type="button"
              onClick={handleVoiceSearch}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors mr-1"
            >
              <Mic size={16} className="text-white/50" />
            </button>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowSortPicker(!showSortPicker)}
                className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors text-xs text-white/40"
              >
                <ArrowUpDown size={12} />
                <span className="hidden sm:inline">
                  {{ distance: "Proximité", price: "Prix", rating: "Note", best_value: "Meilleur rapport" }[sortBy] || "Tri"}
                </span>
              </button>
              {showSortPicker && (
                <div className="absolute top-full right-0 mt-2 bg-neutral-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-30 min-w-[140px]">
                  {[
                    { value: "distance", label: "Proximité" },
                    { value: "price", label: "Prix" },
                    { value: "rating", label: "Note" },
                    { value: "best_value", label: "Meilleur rapport" },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => { setSortBy(opt.value); setShowSortPicker(false); }}
                      className={`w-full text-left px-3 py-2 text-xs transition-all ${
                        sortBy === opt.value
                          ? "text-emerald-400 bg-emerald-500/10"
                          : "text-white/50 hover:bg-white/5"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <ImageSearch
              onSearchQuery={(query) => {
                setSearchQuery(query);
                setTimeout(() => handleSearch(), 100);
              }}
            />
          </div>

          {/* Unified dropdown: facilities + categories */}
          {searchQuery.trim() && (facilitySuggestions.length > 0 || categorySuggestions.length > 0) && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-neutral-900/95 backdrop-blur-xl rounded-xl border border-white/10 shadow-2xl max-h-60 overflow-y-auto z-30">
              <p className="text-[10px] text-white/20 uppercase tracking-widest px-3 pt-2 pb-1">Vendeurs</p>
              {facilitySuggestions.map((v) => (
                <button key={v.id} onClick={() => selectFacility(v)}
                  className="w-full text-left px-3 py-2.5 text-xs text-white/60 hover:bg-white/5 hover:text-white transition-all border-b border-white/5 last:border-0 flex items-center gap-2"
                >
                  <Store size={12} className="text-emerald-400/60 shrink-0" />
                  <span className="truncate">{v.facility_name || v.name}</span>
                  <span className="text-[10px] text-white/20 shrink-0 ml-auto">{v.category}</span>
                </button>
              ))}
              {categorySuggestions.length > 0 && (
                <>
                  <p className="text-[10px] text-white/20 uppercase tracking-widest px-3 pt-2 pb-1">Catégories</p>
                  {categorySuggestions.map((cat) => (
                    <button key={cat} onClick={() => { setSearchQuery(cat); handleSearch(); }}
                      className="w-full text-left px-3 py-2 text-xs text-white/50 hover:bg-white/5 hover:text-white transition-all flex items-center gap-2"
                    >
                      <span className="text-white/20">#</span> {cat}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>

        {/* Quick Categories */}
        <div className="flex gap-2 mt-3 overflow-x-auto pb-1 scrollbar-hide">
          {[
            { label: "Alimentation", icon: Utensils },
            { label: "Services", icon: Wrench },
            { label: "Artisanat", icon: ShoppingBag },
            { label: "Mode", icon: Shirt },
            { label: "Maison", icon: Home },
            { label: "Transport", icon: Truck },
          ].map((cat) => {
            const Icon = cat.icon;
            return (
              <button
                key={cat.label}
                onClick={() => {
                  setSearchQuery(cat.label);
                  setTimeout(() => handleSearch(), 100);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white text-xs transition-all whitespace-nowrap shrink-0"
              >
                <Icon size={12} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Header Right — Modern Nav */}
      <div className={`absolute ${isMobile ? "top-4 right-4" : "top-4 right-4"} z-20 flex items-center gap-2`}>
        <MobileNav
          isAuthenticated={isAuthenticated}
          userName={(() => { try { const u = JSON.parse(localStorage.getItem("omni_user") || "{}"); return u.name; } catch { return null; }})()}
          balance={walletBalance}
        />
        <div className="hidden sm:flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-400 font-medium">Acheteur</span>
          </div>
          {hasVendor && (
            <a href="/vendor/dashboard"
              className="px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/15 border border-white/10 text-white/70 hover:text-white text-xs transition-all"
            >
              Ma boutique
            </a>
          )}
        </div>
        <CartBadge itemCount={cartItemCount} onClick={() => setShowCart(true)} />
        <NotificationBell />
      </div>

      {/* Map Container */}
        <div 
          ref={(el) => { mapContainer.current = el; if (el && mapLibLoaded && userLocation) initMap(el); }}
          className="absolute inset-0 z-0"
          style={{ width: '100%', height: '100%', minHeight: '100vh' }}
        />

      {/* Locate Me Button - Premium */}
      <button
        onClick={() => {
          if (map.current && userLocation) {
            map.current.flyTo({
              center: [userLocation.lon, userLocation.lat],
              zoom: 15,
              pitch: 45,
              duration: 2000,
            });
          }
        }}
        className={`absolute ${isMobile ? "bottom-4 right-4" : "bottom-8 right-6"} z-20 w-12 h-12 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center justify-center hover:bg-black/60 transition-all duration-300 group`}
      >
        <Navigation size={20} className="text-white/70 group-hover:text-white transition-colors" />
      </button>

      {/* Loading Overlay - Premium */}
      {isOffline && cachedVendors.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-amber-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-light shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
          <span>Mode hors ligne - Affichage des r?sultats en cache</span>
        </div>
      )}

      {/* Offline Banner */}
      {isOffline && cachedVendors.length > 0 && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-30 bg-amber-500/90 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-light shadow-xl flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-white/60 animate-pulse" />
          <span>Mode hors ligne - Affichage des r&eacute;sultats en cache</span>
        </div>
      )}

      {/* Error Toast */}
      {error && (
        <div className="absolute top-24 left-1/2 -translate-x-1/2 z-20 bg-amber-500/80 backdrop-blur-md text-white px-4 py-2 rounded-full text-sm font-light shadow-xl">
          {error}
        </div>
      )}

      {/* Bottom Sheet - Facility/Vendor Details */}
      {selectedVendor && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-neutral-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 shadow-2xl max-h-[75vh] overflow-y-auto animate-slide-up">
          <div className="p-5 pb-8">
            {/* Handle */}
            <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            {/* Header */}
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shrink-0 border border-white/5">
                <Store size={22} className="text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-medium text-white truncate">{selectedVendor.facility_name || selectedVendor.name}</h2>
                <div className="flex items-center gap-2 text-white/40 text-sm mt-0.5">
                  {selectedVendor.vendor_name && (
                    <>
                      <span className="text-white/50 text-xs">{selectedVendor.vendor_name}</span>
                      <span className="text-white/20">·</span>
                    </>
                  )}
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                  <span className="truncate">{selectedVendor.category}</span>
                  <span className="text-white/20">·</span>
                  <span className="shrink-0">{selectedVendor.distance ? `${Math.round(selectedVendor.distance)}m` : "À proximité"}</span>
                </div>
                {selectedVendor.type === 'mobile' && (
                  <span className="inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">Mobile</span>
                )}
                {selectedVendor.description && (
                  <p className="text-white/30 text-xs mt-1.5 line-clamp-2">{selectedVendor.description}</p>
                )}
                {selectedVendor.rating && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star size={10} className="text-amber-400 fill-amber-400" />
                    <span className="text-white/40 text-xs">{selectedVendor.rating.toFixed(1)}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <FavoriteButton vendorId={selectedVendor.vendor_id || selectedVendor.id} />
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/5 flex items-center justify-center transition-colors"
                >
                  <X size={14} className="text-white/50" />
                </button>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3 mb-6">
              <button
                onClick={navigateToVendor}
                className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 text-white/80 hover:text-white text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <Navigation size={16} />
                Itinéraire
              </button>
              <button
                onClick={() => isAuthenticated ? setShowVendorChat(true) : window.location.href = "/auth"}
                className="flex-1 py-3 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-sm font-medium transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle size={16} />
                Contacter
              </button>
            </div>

            {/* Section Title */}
            <div className="flex items-center gap-2 mb-4">
              <div className="h-px flex-1 bg-white/5" />
              <span className="text-white/30 text-xs uppercase tracking-widest font-medium">Produits</span>
              <div className="h-px flex-1 bg-white/5" />
            </div>

            {/* Products */}
            <div className="space-y-2.5 mb-4">
              {selectedVendor.products?.map((product) => (
                <div
                  key={product.id}
                  className="bg-white/[0.03] rounded-xl border border-white/[0.06] hover:border-white/10 transition-all overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 flex items-start gap-3">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-12 h-12 rounded-lg object-cover shrink-0" />
                        ) : null}
                        <div>
                          <h4 className="text-white text-sm font-medium">{product.name}</h4>
                          {product.description && (
                            <p className="text-white/30 text-xs mt-0.5 truncate">{product.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-3">
                        <p className="text-emerald-400 font-semibold text-sm">{product.price?.toLocaleString()} <span className="text-xs font-normal text-emerald-400/60">{product.currency || 'FCFA'}</span></p>
                        <p className="text-white/20 text-xs mt-0.5">/{product.unit || 'pièce'}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center bg-white/5 rounded-lg border border-white/10">
                        <button
                          onClick={() => {
                            try {
                              const raw = localStorage.getItem("omni_cart");
                              const cart = raw ? JSON.parse(raw) : { items: [] };
                              const idx = cart.items.findIndex(
                                (it) => it.productId === product.id && it.facilityId === selectedVendor.id
                              );
                              if (idx >= 0 && cart.items[idx].quantity > 0) {
                                cart.items[idx].quantity -= 1;
                                if (cart.items[idx].quantity === 0) cart.items.splice(idx, 1);
                                localStorage.setItem("omni_cart", JSON.stringify(cart));
                                setCartItemCount(cart.items.length);
                              }
                            } catch {}
                          }}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-white text-xs font-medium w-6 text-center">
                          {(() => {
                            try {
                              const raw = localStorage.getItem("omni_cart");
                              const cart = raw ? JSON.parse(raw) : { items: [] };
                              const item = cart.items.find(
                                (it) => it.productId === product.id && it.facilityId === selectedVendor.id
                              );
                              return item ? item.quantity : 0;
                            } catch { return 0; }
                          })()}
                        </span>
                        <button
                          onClick={() => addToCart(product, selectedVendor.id, selectedVendor.facility_name, selectedVendor.vendor_name, selectedVendor.vendor_id)}
                          className="w-8 h-8 flex items-center justify-center text-white/40 hover:text-white transition-colors"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        onClick={() => addToCart(product, selectedVendor.id, selectedVendor.facility_name, selectedVendor.vendor_name, selectedVendor.vendor_id)}
                        className="flex-1 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm transition-all border border-emerald-500"
                      >
                        Ajouter au panier
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {selectedVendor.phone && (
              <div className="flex items-center gap-2 text-white/20 text-xs justify-center pt-2">
                <span>Contact : {selectedVendor.phone}</span>
              </div>
            )}

            {/* Reviews Section */}
            <div className="border-t border-white/[0.06] mt-5 pt-4">
              <button
                onClick={() => {
                  setShowReviews(!showReviews);
                  if (!showReviews && reviews.length === 0 && selectedVendor) loadReviews(selectedVendor.id);
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-all"
              >
                <div className="flex items-center gap-2">
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                  <span className="text-white/60 text-xs">
                    {selectedVendor.rating ? `${selectedVendor.rating.toFixed(1)}` : "—"}
                  </span>
                  <span className="text-white/20 text-xs">
                    ({selectedVendor.review_count || 0} avis)
                  </span>
                </div>
                <span className="text-white/20 text-xs">{showReviews ? "Masquer" : "Voir les avis"}</span>
              </button>
              {showReviews && (
                <div className="mt-3">
                  <ReviewForm facilityId={selectedVendor.id} onSubmitted={() => {
                    loadReviews(selectedVendor.id);
                    loadNearbyVendors(); // refresh rating
                  }} />
                  <div className="mt-3">
                    {reviewsLoading ? (
                      <Loader2 size={14} className="animate-spin mx-auto text-white/20" />
                    ) : (
                      <ReviewList reviews={reviews} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat Modal */}
      {chatRequest && selectedVendor && (
        <ChatModal
          requestId={chatRequest.id}
          vendorName={selectedVendor.name}
          onClose={() => setChatRequest(null)}
        />
      )}

      {/* Vendor Chat Modal */}
      {showVendorChat && selectedVendor && (
        <ChatModal
          requestId={null}
          vendorName={selectedVendor.name}
          vendorId={selectedVendor.id}
          onClose={() => setShowVendorChat(false)}
        />
      )}

      {/* Cart Panel */}
      <CartPanel
        isOpen={showCart}
        onClose={() => setShowCart(false)}
        onItemCountChange={setCartItemCount}
      />

      {/* Loading Overlay - Premium */}
      {loading && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30">
          <div className="w-12 h-12 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        </div>
      )}

      {/* Route Guidance Panel */}
      {showRoute && routeSteps && (
        <div className="absolute bottom-0 left-0 right-0 z-30 bg-neutral-900/95 backdrop-blur-xl rounded-t-3xl border-t border-white/10 shadow-2xl max-h-[50vh] overflow-y-auto animate-slide-up">
          <div className="p-5 pb-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <h3 className="text-white text-sm font-medium">Itinéraire</h3>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] text-emerald-400/80">Guidage vocal auto</span>
                </div>
              </div>
              <button
                onClick={() => { setShowRoute(false); setRouteSteps(null); setAnnouncedSteps(new Set()); }}
                className="w-8 h-8 rounded-full bg-white/5 hover:bg-white/15 border border-white/5 flex items-center justify-center transition-colors"
              >
                <X size={14} className="text-white/50" />
              </button>
            </div>
            <div className="space-y-2">
              {routeSteps.map((step, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex flex-col items-center mt-1">
                    <div className={`w-2 h-2 rounded-full ${announcedSteps.has(i) ? 'bg-emerald-400' : i === 0 ? 'bg-white/40' : 'bg-white/20'}`} />
                    {i < routeSteps.length - 1 && <div className="w-px h-8 bg-white/10" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${announcedSteps.has(i) ? 'text-emerald-400/60' : 'text-white/70'}`}>{step.instruction}</p>
                    <p className="text-white/30 text-xs mt-0.5">{Math.round(step.distance)}m</p>
                  </div>
                  {announcedSteps.has(i) && (
                    <span className="text-[10px] text-emerald-400/40 mt-1 shrink-0">✓ annoncé</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Global Styles */}
      <style>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
        .maplibregl-control-container {
          display: none !important;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
}
