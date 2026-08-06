import { describe, expect, it } from 'vitest';
import { normalizeOsmElement } from '@/app/api/discovery/osm/normalize';

describe('normalizeOsmElement', () => {
  it('normalizes a node with shop tags', () => {
    const element = {
      type: 'node', id: 123456789, lat: 6.1319, lon: 1.2228,
      tags: {
        shop: 'bakery', name: 'Boulangerie de la Paix',
        'addr:street': 'Rue du Commerce', 'addr:city': 'Lomé',
        phone: '+228 90 00 00 00', website: 'https://example.com',
        opening_hours: 'Mo-Sa 07:00-19:00',
      },
    };
    const result = normalizeOsmElement(element);
    expect(result).toMatchObject({
      id: 'osm:node:123456789',
      osmType: 'node',
      osmId: 123456789,
      source: 'osm',
      name: 'Boulangerie de la Paix',
      category: 'shop',
      subcategory: 'bakery',
      lat: 6.1319,
      lon: 1.2228,
      address: 'Rue du Commerce, Lomé',
      phone: '+228 90 00 00 00',
      website: 'https://example.com',
      opening_hours: 'Mo-Sa 07:00-19:00',
      verification_status: 'non_verifiee',
    });
  });

  it('uses the center point for a way element', () => {
    const element = {
      type: 'way', id: 42, center: { lat: 6.14, lon: 1.23 },
      tags: { amenity: 'pharmacy', name: 'Pharmacie du Port' },
    };
    const result = normalizeOsmElement(element);
    expect(result.id).toBe('osm:way:42');
    expect(result.lat).toBe(6.14);
    expect(result.lon).toBe(1.23);
    expect(result.category).toBe('amenity');
    expect(result.subcategory).toBe('pharmacy');
  });

  it('returns null for a way with no center and no direct coordinates', () => {
    const element = { type: 'way', id: 7, tags: { shop: 'convenience' } };
    expect(normalizeOsmElement(element)).toBeNull();
  });

  it('returns null when there are no recognized business tags', () => {
    const element = { type: 'node', id: 1, lat: 1, lon: 1, tags: { natural: 'tree' } };
    expect(normalizeOsmElement(element)).toBeNull();
  });

  it('falls back to a generic label when the OSM object has no name tag', () => {
    const element = { type: 'node', id: 2, lat: 1, lon: 1, tags: { shop: 'kiosk' } };
    const result = normalizeOsmElement(element);
    expect(result.name).toBe('Kiosk (OpenStreetMap)');
  });

  it('never fabricates a rating, product list, or online status', () => {
    const element = { type: 'node', id: 3, lat: 1, lon: 1, tags: { shop: 'clothes', name: 'Boutique X' } };
    const result = normalizeOsmElement(element);
    expect(result.rating).toBeUndefined();
    expect(result.products).toBeUndefined();
    expect(result.is_online).toBeUndefined();
    expect(result.product_count).toBeUndefined();
  });

  it('drops raw OSM tags that are not in the safe allowlist', () => {
    const element = {
      type: 'node', id: 4, lat: 1, lon: 1,
      tags: { shop: 'bakery', name: 'X', 'note': '<script>alert(1)</script>', 'fixme': 'check this' },
    };
    const result = normalizeOsmElement(element);
    expect(result.tags.note).toBeUndefined();
    expect(result.tags.fixme).toBeUndefined();
  });
});
