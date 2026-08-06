export type DiscoveryLocation = {
  lat: number;
  lon: number;
};

export type DiscoveryFacility = Record<string, unknown> & {
  id: string;
};

export class DiscoveryRequestError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "DiscoveryRequestError";
    this.status = status;
  }
}

type DiscoveryRequestOptions = {
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
};

async function requestFacilities(
  path: string,
  payload: Record<string, unknown>,
  {
    fetchImpl = fetch,
    signal,
  }: DiscoveryRequestOptions = {},
): Promise<DiscoveryFacility[]> {
  const response = await fetchImpl(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal,
  });

  if (!response.ok) {
    throw new DiscoveryRequestError(
      "Discovery request failed",
      response.status,
    );
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new DiscoveryRequestError("Invalid discovery response");
  }
  if (!Array.isArray(body?.facilities)) {
    throw new DiscoveryRequestError("Invalid discovery response");
  }
  return body.facilities;
}

export function loadNearbyFacilities(
  location: DiscoveryLocation,
  {
    radius = 10_000,
    ...options
  }: DiscoveryRequestOptions & { radius?: number } = {},
) {
  return requestFacilities(
    "/api/facilities/nearby",
    { ...location, radius },
    options,
  );
}

export function loadNearbyOsmBusinesses(
  location: DiscoveryLocation,
  {
    radius = 1_500,
    ...options
  }: DiscoveryRequestOptions & { radius?: number } = {},
) {
  return requestFacilities("/api/discovery/osm", { ...location, radius }, options);
}

export function searchFacilitiesByText(
  location: DiscoveryLocation,
  query: string,
  {
    radius = 5_000,
    ...options
  }: DiscoveryRequestOptions & { radius?: number } = {},
) {
  const search = query.trim();
  if (!search) {
    throw new DiscoveryRequestError("A search query is required", 400);
  }
  return requestFacilities(
    "/api/facilities/search",
    { ...location, search, radius },
    options,
  );
}
