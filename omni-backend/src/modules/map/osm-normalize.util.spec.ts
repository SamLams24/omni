import { normalizeOsmElement } from './osm-normalize.util';

describe('normalizeOsmElement', () => {
  it('returns null for an element with no recognized category tag', () => {
    const result = normalizeOsmElement({
      type: 'node',
      id: 1,
      lat: 6.13,
      lon: 1.21,
      tags: { building: 'yes' },
    });
    expect(result).toBeNull();
  });

  it('returns null when coordinates are missing (a way with no center)', () => {
    const result = normalizeOsmElement({
      type: 'way',
      id: 2,
      tags: { shop: 'bakery' },
    });
    expect(result).toBeNull();
  });

  it('normalizes a node with a stable osm:<type>:<id> id and UNCONFIRMED status', () => {
    const result = normalizeOsmElement({
      type: 'node',
      id: 12345,
      lat: 6.137,
      lon: 1.215,
      tags: { shop: 'supermarket', name: 'Marché Central' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 'osm:node:12345',
        source: 'osm',
        businessId: null,
        name: 'Marché Central',
        category: 'shop',
        subcategory: 'supermarket',
        status: 'UNCONFIRMED',
      }),
    );
  });

  it('reads center coordinates for a way', () => {
    const result = normalizeOsmElement({
      type: 'way',
      id: 99,
      center: { lat: 6.2, lon: 1.3 },
      tags: { amenity: 'hospital' },
    });
    expect(result?.latitude).toBe(6.2);
    expect(result?.longitude).toBe(1.3);
  });

  it('falls back to a humanized subcategory name when the element has no name tag', () => {
    const result = normalizeOsmElement({
      type: 'node',
      id: 5,
      lat: 6.1,
      lon: 1.2,
      tags: { amenity: 'fuel_station' },
    });
    expect(result?.name).toBe('Fuel Station (OpenStreetMap)');
  });

  it('never forwards an unlisted tag, even if present on the raw element', () => {
    const result = normalizeOsmElement({
      type: 'node',
      id: 7,
      lat: 6.1,
      lon: 1.2,
      tags: { shop: 'bakery', 'unsafe:script': '<script>alert(1)</script>' },
    });
    expect(result?.tags).not.toHaveProperty('unsafe:script');
  });
});
