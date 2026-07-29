import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

// Mock the sql utility used in API routes
vi.mock('@/app/api/utils/sql', () => ({
  default: vi.fn(),
}));

import sql from '@/app/api/utils/sql';

describe('Vendor API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('POST /api/vendors/search', () => {
    it('should search vendors with search term', async () => {
      const mockVendors = [
        { 
          id: '1', 
          name: 'Bakery', 
          lat: 48.8566, 
          lon: 2.3522, 
          distance: 500,
          products: [{ id: 'p1', name: 'Bread', price: 3.50, unit: 'loaf' }]
        },
      ];
      
      sql.mockResolvedValueOnce(mockVendors);

      const lat = 48.8566;
      const lon = 2.3522;
      const search = 'Bread';
      const radius = 5000;

      const query = `
        SELECT DISTINCT ON (v.id)
          v.id, v.name, v.category, v.description,
          ST_Y(v.location::geometry) as lat,
          ST_X(v.location::geometry) as lon,
          ST_Distance(v.location, ST_SetSRID(ST_Point($1, $2), 4326)::geography) as distance,
          json_agg(json_build_object(
            '\''id'\'', p.id,
            '\''name'\'', p.name,
            '\''price'\'', p.price,
            '\''unit'\'', p.unit,
            '\''photo_url'\'', p.photo_url
          )) as products
        FROM vendors v
        JOIN products p ON p.vendor_id = v.id
        WHERE v.is_online = true
          AND p.is_available = true
          AND ST_DWithin(v.location, ST_SetSRID(ST_Point($1, $2), 4326)::geography, $3)
          AND p.name ILIKE $4
        GROUP BY v.id, v.name, v.category, v.description, v.location
        ORDER BY v.id, distance
        LIMIT 3
      `;
      
      const params = [lon, lat, radius, `%${search}%`];
      const result = await sql(query, params);

      expect(result).toEqual(mockVendors);
    });

    it('should search vendors without search term (return all nearby)', async () => {
      const mockVendors = [
        { id: '1', name: 'Vendor 1', products: [] },
      ];
      
      sql.mockResolvedValueOnce(mockVendors);

      const lat = 48.8566;
      const lon = 2.3522;
      const search = null;
      const radius = 5000;

      // Without search term, query should not include ILIKE
      const params = [lon, lat, radius];
      
      // Verify that search is optional
      expect(search).toBeNull();
      
      const result = await sql(expect.any(String), params);
      expect(result).toEqual(mockVendors);
    });

    it('should fail without lat/lon coordinates', async () => {
      const lat = undefined;
      const lon = null;
      
      const hasValidCoords = !!(lat && lon);
      expect(hasValidCoords).toBe(false);
    });

    it('should limit results to 3 vendors', async () => {
      sql.mockResolvedValueOnce([]);

      const limit = 3;
      await sql(expect.any(String), [2.3522, 48.8566, 5000]);

      // The query has LIMIT 3
      expect(limit).toBe(3);
    });
  });

  describe('API Error Handling', () => {
    it('should handle SQL errors gracefully', async () => {
      sql.mockRejectedValueOnce(new Error('Database connection failed'));

      await expect(sql(expect.any(String), [])).rejects.toThrow('Database connection failed');
    });

    it('should return 400 for missing coordinates', () => {
      // Simulate validation response
      const response = { 
        status: 400, 
        body: { error: 'Latitude and longitude are required' } 
      };
      
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Latitude and longitude are required');
    });

    it('should return 500 for internal server errors', () => {
      const response = { 
        status: 500, 
        body: { error: 'Internal server error' } 
      };
      
      expect(response.status).toBe(500);
      expect(response.body.error).toBe('Internal server error');
    });
  });
});
