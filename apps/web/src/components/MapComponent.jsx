"use client";

import { useState, useEffect, useRef } from "react";
// Dynamic imports to prevent SSR issues
const importLeaflet = () => import("leaflet");
const importLeafletCSS = () => import("leaflet/dist/leaflet.css");
// Dynamic import disabled to prevent SSR issues
// const importRoutingMachine = () => import("leaflet-routing-machine");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Fix Leaflet default icon (will be applied after dynamic import)
let leafletIconFixed = false;
const fixLeafletIcon = (L) => {
  if (!leafletIconFixed && L) {
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
    leafletIconFixed = true;
  }
};

export default function MapComponent({ center, zoom, markers = [], onVendorClick, showRoute, targetVendor }) {
  const [isClient, setIsClient] = useState(false);
  const [L, setL] = useState(null); // Store L in state
  const [mapReady, setMapReady] = useState(false); // Wait for L to be ready
  const mapRef = useRef();
  const mapInstanceRef = useRef();
  const markersRef = useRef([]);
  const routeControlRef = useRef([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!isClient || !center || !mapRef.current) return;

    // Dynamic import Leaflet and CSS
    const initializeMap = async () => {
      try {
        // Import Leaflet CSS
        await importLeafletCSS();
        
        // Import Leaflet
        const leafletModule = await importLeaflet();
        const L = leafletModule.default;
        
        // Store L in state
        setL(L);
        setMapReady(true);
        
        // Fix Leaflet icons
        fixLeafletIcon(L);

        // Initialize map
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapRef.current).setView([center.lat, center.lon], zoom);
          
          // Add OpenStreetMap tiles
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap contributors',
            maxZoom: 19
          }).addTo(mapInstanceRef.current);
        } else {
          // Update view if center changes
          mapInstanceRef.current.setView([center.lat, center.lon], zoom);
        }

        // Clear existing markers
        markersRef.current.forEach(marker => {
          mapInstanceRef.current.removeLayer(marker);
        });
        markersRef.current = [];

        // Add user position marker (blue with pulse animation)
        const userMarker = L.marker([center.lat, center.lon], {
          icon: L.divIcon({
            className: 'custom-div-icon',
            html: '<div style="background-color: #3B82F6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 4px 8px rgba(59, 130, 246, 0.5); animation: pulse 2s infinite;"></div>',
            iconSize: [22, 22],
            iconAnchor: [11, 11]
          })
        }).bindPopup(`
          <div style="text-align: center; min-width: 150px;">
            <div style="font-weight: bold; color: #3B82F6; margin-bottom: 4px;">📍 Votre Position</div>
            <div style="font-size: 12px; color: #666;">Précision GPS excellente</div>
            <div style="font-size: 11px; color: #999; margin-top: 2px;">${center.lat.toFixed(4)}, ${center.lon.toFixed(4)}</div>
          </div>
        `).addTo(mapInstanceRef.current);
        markersRef.current.push(userMarker);

        // Add vendor markers (red with animations)
        markers.forEach((vendor, index) => {
          const isOnline = vendor.is_online !== false; // Default to online
          const markerColor = isOnline ? "#EF4444" : "#9CA3AF";
          const statusIcon = isOnline ? "🟢" : "⚫";
          
          const vendorMarker = L.marker([vendor.lat, vendor.lon], {
            icon: L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div style="
                  position: relative;
                  background-color: ${markerColor}; 
                  width: 12px; 
                  height: 12px; 
                  border-radius: 50%; 
                  border: 2px solid white; 
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                  animation: bounce 2s infinite;
                  animation-delay: ${index * 0.2}s;
                ">
                  <div style="
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    font-size: 8px;
                    background: white;
                    border-radius: 50%;
                    width: 12px;
                    height: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.3);
                  ">${statusIcon}</div>
                </div>
              `,
              iconSize: [20, 20],
              iconAnchor: [10, 10]
            })
          }).on('click', () => {
            if (onVendorClick) {
              onVendorClick(vendor);
            }
          }).bindPopup(`
            <div style="text-align: center; min-width: 220px; font-family: system-ui;">
              <div style="display: flex; align-items: center; justify-content: center; margin-bottom: 8px;">
                <div style="
                  background: linear-gradient(135deg, ${markerColor}, ${isOnline ? '#DC2626' : '#6B7280'});
                  color: white;
                  padding: 4px 8px;
                  border-radius: 12px;
                  font-size: 11px;
                  font-weight: bold;
                  margin-right: 8px;
                ">${statusIcon} ${isOnline ? 'EN LIGNE' : 'HORS LIGNE'}</div>
                <div style="font-size: 16px;">🏪</div>
              </div>
              
              <div style="font-weight: bold; color: #1F2937; margin-bottom: 4px;">${escapeHtml(vendor.name)}</div>
              <div style="font-size: 12px; color: #6B7280; margin-bottom: 4px;">${escapeHtml(vendor.category)}</div>
              <div style="font-size: 11px; color: #9CA3AF; margin-bottom: 8px;">📍 ${Math.round(vendor.distance)}m • ⏱️ ${Math.round(vendor.distance/60)}min à pied</div>

              <div style="margin: 8px 0; padding: 8px; background: #F9FAFB; border-radius: 8px;">
                <div style="font-size: 12px; margin-bottom: 4px; color: #374151;">📦 Produits disponibles:</div>
                ${vendor.products ? vendor.products.slice(0, 3).map(p =>
                  `<div style="font-size: 11px; margin: 2px 0; color: #6B7280;">• ${escapeHtml(p.name)} - <span style="color: #059669; font-weight: bold;">${escapeHtml(p.price)} FCFA</span></div>`
                ).join('') : '<div style="font-size: 11px; color: #9CA3AF;">🔄 Chargement...</div>'}
              </div>

              <button
                class="check-availability-btn"
                style="
                  background: linear-gradient(135deg, #10B981, #059669); 
                  color: white; 
                  border: none; 
                  padding: 8px 16px; 
                  border-radius: 8px; 
                  cursor: pointer;
                  font-size: 12px;
                  font-weight: bold;
                  width: 100%;
                  transition: all 0.2s;
                  box-shadow: 0 2px 4px rgba(16, 185, 129, 0.3);
                "
                onmouseover="this.style.transform='scale(1.05)'; this.style.boxShadow='0 4px 8px rgba(16, 185, 129, 0.4)'"
                onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 2px 4px rgba(16, 185, 129, 0.3)'"
              >
                ✅ Vérifier disponibilité
              </button>
            </div>
          `).on('popupopen', () => {
            // Attach the handler programmatically (never via an inline
            // onclick string) so vendor.id never crosses an HTML/JS
            // attribute boundary.
            const popupNode = vendorMarker.getPopup()?.getElement();
            const button = popupNode?.querySelector('.check-availability-btn');
            if (button && onVendorClick) {
              button.onclick = () => onVendorClick(vendor);
            }
          }).addTo(mapInstanceRef.current);
          markersRef.current.push(vendorMarker);
        });

      } catch (error) {
        console.error('Error initializing map:', error);
      }
    };

    initializeMap();

  }, [isClient, center, zoom, markers]);

  // Handle routing - TEMPORARILY DISABLED
  useEffect(() => {
    // Temporarily disabled to fix SSR issues
    return;
    
    if (!mapInstanceRef.current || !showRoute || !targetVendor) return;
    if (typeof window === 'undefined') return; // SSR protection

    // Remove existing route if any
    if (routeControlRef.current) {
      mapInstanceRef.current.removeControl(routeControlRef.current);
      routeControlRef.current = null;
    }

    // Add new route with dynamic import
    const addRoute = async () => {
      try {
        const { default: Routing } = await importRoutingMachine();
        
        routeControlRef.current = Routing.control({
          waypoints: [
            L.latLng(center.lat, center.lon),
            L.latLng(targetVendor.lat, targetVendor.lon)
          ],
          routeWhileDragging: false,
          addWaypoints: false,
          createMarker: function() { return null; }, // Don't create extra markers
          lineOptions: {
            styles: [
              { color: '#10B981', weight: 6, opacity: 0.8 },
              { color: '#ffffff', weight: 2, opacity: 1, dashArray: '10, 10' }
            ]
          },
          show: false,
          showAlternatives: false,
          fitSelectedRoutes: true,
          router: Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org',
            profile: 'foot' // Walking route
          })
        }).addTo(mapInstanceRef.current);

        // Listen for route calculation
        routeControlRef.current.on('routesfound', function(e) {
          const routes = e.routes;
          const summary = routes[0].summary;
          console.log('Route found:', summary);
        });

      } catch (error) {
        console.error('Routing error:', error);
      }
    };

    addRoute();

  }, [isClient, center, showRoute, targetVendor]);

  // Clear route when not showing
  useEffect(() => {
    if (!showRoute && routeControlRef.current && mapInstanceRef.current) {
      mapInstanceRef.current.removeControl(routeControlRef.current);
      routeControlRef.current = null;
    }
  }, [showRoute]);

  if (!isClient || !center) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-100">
        <div className="text-gray-500">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      <div 
        ref={mapRef} 
        className="w-full h-full rounded-lg"
        style={{ height: "100%", width: "100%" }}
      />
      
      {/* Info Panel */}
      <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-50">
        <div className="text-sm">
          <div className="font-semibold text-gray-800"> OpenStreetMap</div>
          <div className="text-xs text-gray-600"> Centre: {center.lat.toFixed(4)}, {center.lon.toFixed(4)}</div>
          <div className="text-xs text-gray-600"> Vendeurs: {markers.length} trouvés</div>
          <div className="text-xs text-gray-600"> Temps réel: Actif</div>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-50">
        <div className="flex flex-col gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full animate-pulse"></div>
            <span> Votre position</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded-full relative">
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full"></div>
            </div>
            <span> Vendeurs en ligne</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-gray-400 rounded-full relative">
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-gray-600 rounded-full"></div>
            </div>
            <span> Vendeurs hors ligne</span>
          </div>
        </div>
      </div>

      {/* Live Activity Indicator */}
      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-lg z-50">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-xs font-medium"> Live</span>
        </div>
        <div className="text-xs text-gray-600 mt-1">
          {new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Animated compass */}
      <div className="absolute bottom-4 right-4 bg-white/90 backdrop-blur-sm rounded-full p-3 shadow-lg z-50">
        <div className="w-12 h-12 relative animate-spin-slow">
          <div className="absolute inset-0 border-4 border-gray-200 rounded-full"></div>
          <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <div className="w-0 h-0 border-l-4 border-r-4 border-b-8 border-transparent border-b-red-500"></div>
          </div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-red-500">N</div>
        </div>
      </div>
    </div>
  );
}
