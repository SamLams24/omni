import { describe, expect, it } from 'vitest';
import { deriveVerificationStatus } from '@/lib/vendor-verification';

describe('deriveVerificationStatus', () => {
  it('is non_verifiee for an unclaimed OSM business', () => {
    expect(
      deriveVerificationStatus({ source: 'osm', claimed: false, kycStatus: null, subscriptionActive: false })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when no KYC has been submitted', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'none', subscriptionActive: false })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee while KYC is pending, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'pending', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when KYC was rejected, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'rejected', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is non_verifiee when KYC was revoked, even with an active subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'revoked', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is verifiee when KYC is approved and there is no subscription', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: false })
    ).toBe('verifiee');
  });

  it('is certifiee when KYC is approved and the subscription is active and paid', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: true })
    ).toBe('certifiee');
  });

  it('downgrades from certifiee back to verifiee once the subscription is no longer active', () => {
    const certified = deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: true });
    const afterExpiry = deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'approved', subscriptionActive: false });
    expect(certified).toBe('certifiee');
    expect(afterExpiry).toBe('verifiee');
  });

  it('downgrades all the way to non_verifiee if KYC is revoked after certification', () => {
    expect(
      deriveVerificationStatus({ source: 'omni', claimed: true, kycStatus: 'revoked', subscriptionActive: true })
    ).toBe('non_verifiee');
  });

  it('is always non_verifiee for OSM source regardless of kyc/subscription inputs', () => {
    expect(
      deriveVerificationStatus({ source: 'osm', claimed: true, kycStatus: 'approved', subscriptionActive: true })
    ).toBe('non_verifiee');
  });
});
