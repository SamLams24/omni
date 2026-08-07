import type { StyleSpecification } from "maplibre-gl";

// Raster tiles (CartoDB dark basemap + OSM raster fallback) -- no API key,
// no vector tile server dependency, ported from the legacy map's style
// (apps/web/src/app/map/page.jsx), stripped of the CDN <script> loading
// pattern in favor of the maplibre-gl npm package.
export const darkMapStyle: StyleSpecification = {
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
      attribution: "© OpenStreetMap contributors, © CARTO",
      minzoom: 0,
      maxzoom: 20,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#050510" } },
    {
      id: "carto-tiles",
      type: "raster",
      source: "carto",
      paint: { "raster-opacity": 1 },
    },
  ],
};
