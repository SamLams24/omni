import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type Bbox = { south: number; west: number; north: number; east: number };

export type OsmElement = {
  type: 'node' | 'way' | 'relation';
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

// A deliberately broad set covering the mission's explicit list: shops,
// restaurants, cafes, bars, hotels, pharmacies, hospitals, clinics, banks,
// ATMs, supermarkets, schools, universities, fuel stations, garages, beauty
// salons/barbers, marketplaces, stores, offices, services, tourism, and
// public services. `shop=*` and `office=*` are left unfiltered (no
// allowlist) since they already cover supermarkets/marketplaces/hairdressers
// /barbers/stores/services without needing an exhaustive value list.
const AMENITY_VALUES = [
  'restaurant',
  'cafe',
  'fast_food',
  'bar',
  'pub',
  'pharmacy',
  'clinic',
  'doctors',
  'hospital',
  'dentist',
  'bank',
  'atm',
  'fuel',
  'marketplace',
  'bakery',
  'veterinary',
  'car_repair',
  'driving_school',
  'bureau_de_change',
  'school',
  'university',
  'college',
  'library',
  'townhall',
  'post_office',
  'police',
  'fire_station',
  'courthouse',
];
const TOURISM_VALUES = [
  'hotel',
  'guest_house',
  'hostel',
  'apartment',
  'attraction',
  'museum',
];

export class OsmOverpassError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OsmOverpassError';
  }
}

type CacheEntry = { elements: OsmElement[]; storedAt: number };

const CACHE_MAX_ENTRIES = 200;

@Injectable()
export class OverpassService {
  private readonly logger = new Logger(OverpassService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly config: ConfigService) {}

  private get endpoint(): string {
    return this.config.get<string>('OVERPASS_API_URL')!;
  }

  private get cacheTtlMs(): number {
    return this.config.get<number>('OSM_CACHE_TTL_SECONDS')! * 1000;
  }

  private cacheKey(bbox: Bbox): string {
    // ~500m grid cells so nearby pans/zooms reuse the same cache entry
    // instead of missing on every pixel of viewport movement.
    const round = (n: number) => Math.round(n * 200) / 200;
    return [
      round(bbox.south),
      round(bbox.west),
      round(bbox.north),
      round(bbox.east),
    ].join(',');
  }

  private readCache(key: string): OsmElement[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    if (Date.now() - entry.storedAt > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }
    return entry.elements;
  }

  private writeCache(key: string, elements: OsmElement[]): void {
    if (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    this.cache.set(key, { elements, storedAt: Date.now() });
  }

  private buildQuery(bbox: Bbox): string {
    const box = `${bbox.south},${bbox.west},${bbox.north},${bbox.east}`;
    const amenityFilter = AMENITY_VALUES.join('|');
    const tourismFilter = TOURISM_VALUES.join('|');
    return `[out:json][timeout:20];(
      node["shop"](${box});way["shop"](${box});
      node["amenity"~"^(${amenityFilter})$"](${box});way["amenity"~"^(${amenityFilter})$"](${box});
      node["office"](${box});way["office"](${box});
      node["craft"](${box});way["craft"](${box});
      node["healthcare"](${box});way["healthcare"](${box});
      node["tourism"~"^(${tourismFilter})$"](${box});way["tourism"~"^(${tourismFilter})$"](${box});
    );out center tags;`;
  }

  async queryElements(bbox: Bbox): Promise<OsmElement[]> {
    const key = this.cacheKey(bbox);
    const cached = this.readCache(key);
    if (cached) {
      return cached;
    }

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'OmniApp/1.0 (+https://omni.app; discovery-map)',
        },
        body: this.buildQuery(bbox),
        signal: AbortSignal.timeout(25_000),
      });

      if (!response.ok) {
        throw new OsmOverpassError(
          `Overpass request failed with status ${response.status}`,
        );
      }

      const data = (await response.json()) as { elements?: unknown };
      const elements = Array.isArray(data.elements)
        ? (data.elements as OsmElement[])
        : [];
      this.writeCache(key, elements);
      return elements;
    } catch (error) {
      this.logger.warn(`Overpass request failed: ${String(error)}`);
      if (error instanceof OsmOverpassError) {
        throw error;
      }
      throw new OsmOverpassError(
        `Overpass request could not be completed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}
