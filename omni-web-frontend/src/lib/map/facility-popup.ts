import type { MapFacility } from "@/types/business";

type PopupLabels = {
  status: Record<MapFacility["status"], string>;
  source: { osm: string; omni: string };
  fields: { phone: string; address: string; website: string; openingHours: string };
};

/**
 * Builds popup DOM nodes via createElement/textContent only -- never
 * innerHTML. Facility name/address/tags can originate from OpenStreetMap,
 * which anyone can edit, so treating any of it as trusted markup would be
 * an XSS vector.
 */
export function buildFacilityPopupContent(
  facility: MapFacility,
  labels: PopupLabels,
): HTMLElement {
  const root = document.createElement("div");
  root.className = "omni-map-popup";

  const title = document.createElement("p");
  title.className = "omni-map-popup__title";
  title.textContent = facility.name;
  root.appendChild(title);

  const badge = document.createElement("span");
  badge.className = `omni-map-popup__badge omni-map-popup__badge--${facility.status.toLowerCase()}`;
  badge.textContent = labels.status[facility.status];
  root.appendChild(badge);

  const source = document.createElement("p");
  source.className = "omni-map-popup__source";
  source.textContent = facility.source === "osm" ? labels.source.osm : labels.source.omni;
  root.appendChild(source);

  const fields: Array<[string | null, string]> = [
    [facility.address, labels.fields.address],
    [facility.phone, labels.fields.phone],
    [facility.website, labels.fields.website],
    [facility.openingHours, labels.fields.openingHours],
  ];

  for (const [value, label] of fields) {
    if (!value) continue;
    const row = document.createElement("p");
    row.className = "omni-map-popup__field";
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    row.appendChild(strong);
    row.appendChild(document.createTextNode(value));
    root.appendChild(row);
  }

  return root;
}
