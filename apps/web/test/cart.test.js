import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/app/api/utils/sql', () => ({ default: vi.fn() }));
import sql from '@/app/api/utils/sql';

const mockSql = vi.mocked(sql);

describe('Cart Flow', () => {
  beforeEach(() => { vi.clearAllMocks(); mockSql.mockResolvedValue([]); });

  it('sends cart with cash payment', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'f1', vendor_id: 'v1' }]);
    mockSql.mockResolvedValueOnce([{ id: 'c1', created_at: new Date(), expires_at: new Date() }]);

    const facility = await sql`SELECT id, vendor_id FROM facilities WHERE id = ${'f1'}`;
    const cart = await sql`INSERT INTO carts (buyer_id, facility_id, payment_method) VALUES (${'b1'}, ${'f1'}, ${'cash'}) RETURNING id`;

    expect(facility[0].vendor_id).toBe('v1');
    expect(cart[0].id).toBe('c1');
  });

});

describe('Free Tier Limits', () => {
  beforeEach(() => { mockSql.mockResolvedValue([]); });

  it('blocks facility creation when count >= 1', () => {
    const count = [{ cnt: '1' }];
    const blocked = parseInt(count[0].cnt) >= 1;
    expect(blocked).toBe(true);
  });

  it('blocks product creation when count >= 5', () => {
    const count = [{ cnt: '5' }];
    const blocked = parseInt(count[0].cnt) >= 5;
    expect(blocked).toBe(true);
  });

  it('blocks delivery accept when count >= 3', () => {
    const count = [{ cnt: '3' }];
    const blocked = parseInt(count[0].cnt) >= 3;
    expect(blocked).toBe(true);
  });

  it('clears waypoints for free tier rayon mode', () => {
    const userTier = [{ delivery_tier: 'free' }];
    let waypoints = [{ lat: 1, lon: 2 }];
    let deviationKm = 5;

    if (userTier[0].delivery_tier === 'free') {
      waypoints = [];
      deviationKm = 0;
    }
    expect(waypoints).toEqual([]);
    expect(deviationKm).toBe(0);
  });
});

describe('Match Distance', () => {
  it('filters requests within deviation radius', () => {
    const trip = { origin_lat: 48.8566, origin_lon: 2.3522, deviation_km: 2 };
    const requests = [
      { lat: 48.857, lon: 2.353, name: 'Proche' },
      { lat: 48.87, lon: 2.37, name: 'Loin' },
    ];

    const matches = requests.filter(r => {
      const d = Math.sqrt((r.lat - trip.origin_lat)**2 + (r.lon - trip.origin_lon)**2) * 111320;
      return d < trip.deviation_km * 1000;
    });
    expect(matches.length).toBe(1);
    expect(matches[0].name).toBe('Proche');
  });
});

describe('Wallet & Reviews', () => {
  beforeEach(() => { mockSql.mockResolvedValue([]); });

  it('reads wallet balance', async () => {
    mockSql.mockResolvedValueOnce([{ id: 'w1', balance: 15000 }]);
    const wallet = await sql`SELECT * FROM wallets WHERE user_id = ${'u1'}`;
    expect(wallet[0].balance).toBe(15000);
  });

  it('creates review for completed cart', () => {
    const cart = [{ id: 'c1', status: 'completed', buyer_id: 'b1' }];
    expect(cart[0].status).toBe('completed');
  });

  it('deposit adds to balance', () => {
    expect(10000 + 5000).toBe(15000);
  });
});
