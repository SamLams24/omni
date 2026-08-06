import { describe, expect, it } from 'vitest';
import { normalizeGeoRow } from '@/app/api/discovery/geo';

describe('normalizeGeoRow verification status', () => {
  it('derives certifiee for an approved, actively-subscribed facility row', () => {
    const row = {
      id: 'f1', lat: '6.13', lon: '1.22', distance: '120.5',
      rating: null, product_count: '2', review_count: '0', avg_price: '500',
      kyc_status: 'approved', claimed: true, subscription_active: true,
    };
    const result = normalizeGeoRow(row);
    expect(result.verification_status).toBe('certifiee');
    expect(result.source).toBe('omni');
    expect(result.kyc_status).toBeUndefined();
  });

  it('derives non_verifiee for a pending-KYC facility row', () => {
    const row = {
      id: 'f2', lat: '6.13', lon: '1.22', distance: '80',
      rating: null, product_count: '0', review_count: '0', avg_price: '0',
      kyc_status: 'pending', claimed: true, subscription_active: false,
    };
    expect(normalizeGeoRow(row).verification_status).toBe('non_verifiee');
  });

  it('leaves rows without kyc_status (e.g. findNearbyVendors) untouched', () => {
    const row = {
      id: 'v1', lat: '6.13', lon: '1.22', distance: '80',
      rating: null, product_count: '0', avg_price: '0',
    };
    const result = normalizeGeoRow(row);
    expect(result.verification_status).toBeUndefined();
    expect(result.source).toBeUndefined();
  });
});
