import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/api/discovery/osm/route';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('GET /api/discovery/osm', () => {
  it('returns normalized OSM facilities for a valid bbox query', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        elements: [
          { type: 'node', id: 1, lat: 6.13, lon: 1.22, tags: { shop: 'bakery', name: 'Boulangerie X' } },
          { type: 'node', id: 2, lat: 1, lon: 1, tags: { natural: 'tree' } },
        ],
      })
    );
    vi.stubGlobal('fetch', fetchMock);

    const response = await GET(
      new Request('https://omni.test/api/discovery/osm?lat=6.13&lon=1.22')
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.facilities).toHaveLength(1);
    expect(body.facilities[0]).toMatchObject({ source: 'osm', verification_status: 'non_verifiee' });
  });

  it('returns 400 for invalid coordinates', async () => {
    const response = await GET(new Request('https://omni.test/api/discovery/osm?lat=999&lon=1.22'));
    expect(response.status).toBe(400);
  });

  it('fails soft with an empty list when Overpass is unavailable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 504 })));

    const response = await GET(new Request('https://omni.test/api/discovery/osm?lat=7.5&lon=2.1'));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.facilities).toEqual([]);
  });
});
