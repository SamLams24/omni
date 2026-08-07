"use client";

import { useEffect, useRef } from "react";
import {
  AttributionControl,
  Marker,
  MapLibreMap,
  NavigationControl,
  Popup,
  type LngLatBounds,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useTranslations } from "next-intl";
import { loadClientEnv } from "@/lib/env/client";
import { browserApiRequest } from "@/lib/api/browser-client";
import { darkMapStyle } from "@/lib/map/style";
import { buildFacilityPopupContent } from "@/lib/map/facility-popup";
import type { Bbox, MapFacility } from "@/types/business";

const DEBOUNCE_MS = 400;
const FETCH_TIMEOUT_MS = 15_000;
// ~50m grid: skip refetching when the viewport has barely moved.
const DEDUP_PRECISION = 4;

const STATUS_COLOR: Record<MapFacility["status"], string> = {
  UNCONFIRMED: "#9ca3af",
  CONFIRMED: "#38bdf8",
  CERTIFIED: "#facc15",
};

function boundsToBbox(bounds: LngLatBounds): Bbox {
  return {
    south: bounds.getSouth(),
    west: bounds.getWest(),
    north: bounds.getNorth(),
    east: bounds.getEast(),
  };
}

function bboxKey(bbox: Bbox): string {
  const round = (n: number) => n.toFixed(DEDUP_PRECISION);
  return `${round(bbox.south)},${round(bbox.west)},${round(bbox.north)},${round(bbox.east)}`;
}

export function OmniMap() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const lastBboxKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const t = useTranslations("map");
  const tBusiness = useTranslations("business");

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const env = loadClientEnv();
    const map = new MapLibreMap({
      container,
      style: darkMapStyle,
      center: [env.NEXT_PUBLIC_MAP_DEFAULT_LON, env.NEXT_PUBLIC_MAP_DEFAULT_LAT],
      zoom: env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM,
      attributionControl: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl(), "top-right");
    // OSM attribution must always be visible, never collapsed into a
    // toggle -- compact: false keeps it expanded on every screen size.
    map.addControl(new AttributionControl({ compact: false }), "bottom-right");

    const labels = {
      status: {
        UNCONFIRMED: tBusiness("status.UNCONFIRMED"),
        CONFIRMED: tBusiness("status.CONFIRMED"),
        CERTIFIED: tBusiness("status.CERTIFIED"),
      },
      source: { osm: tBusiness("source.osm"), omni: tBusiness("source.omni") },
      fields: {
        phone: tBusiness("fields.phone"),
        address: tBusiness("fields.address"),
        website: tBusiness("fields.website"),
        openingHours: tBusiness("fields.openingHours"),
      },
    };

    function clearMarkers() {
      for (const marker of markersRef.current) marker.remove();
      markersRef.current = [];
    }

    async function fetchFacilities() {
      const bounds = map.getBounds();
      const bbox = boundsToBbox(bounds);
      const key = bboxKey(bbox);
      if (key === lastBboxKeyRef.current) return;
      lastBboxKeyRef.current = key;

      abortControllerRef.current?.abort();
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const facilities = await browserApiRequest<MapFacility[]>("/map/facilities", {
          method: "GET",
          signal: controller.signal,
          timeoutMs: FETCH_TIMEOUT_MS,
          cache: "no-store",
        });
        // A newer request may have started (and won the dedup check)
        // while this one was in flight -- drop a stale response.
        if (controller.signal.aborted) return;

        clearMarkers();
        for (const facility of facilities) {
          const el = document.createElement("div");
          el.style.width = "14px";
          el.style.height = "14px";
          el.style.borderRadius = "50%";
          el.style.border = "2px solid #050510";
          el.style.backgroundColor = STATUS_COLOR[facility.status];
          el.style.cursor = "pointer";

          const popup = new Popup({ offset: 12, closeButton: true }).setDOMContent(
            buildFacilityPopupContent(facility, labels),
          );

          const marker = new Marker({ element: el })
            .setLngLat([facility.longitude, facility.latitude])
            .setPopup(popup)
            .addTo(map);
          markersRef.current.push(marker);
        }
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Failed to load map facilities", error);
      }
    }

    function scheduleFetch() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        void fetchFacilities();
      }, DEBOUNCE_MS);
    }

    map.on("load", scheduleFetch);
    map.on("moveend", scheduleFetch);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortControllerRef.current?.abort();
      clearMarkers();
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- MapLibre instance is created once; translations are read via refs captured at init time, matching the map's own imperative lifecycle.
  }, []);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <p className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-1 text-xs text-neutral-300">
        {t("attribution")} © {t("attributionOsm")}
      </p>
    </div>
  );
}
