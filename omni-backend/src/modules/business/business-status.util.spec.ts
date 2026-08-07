import { computeBusinessStatus } from './business-status.util';

describe('computeBusinessStatus', () => {
  it('is always UNCONFIRMED for OSM-sourced facilities, even with an approved KYC status and an active subscription', () => {
    expect(
      computeBusinessStatus({
        source: 'OSM',
        kycStatus: 'APPROVED',
        hasActivePremiumSubscription: true,
      }),
    ).toBe('UNCONFIRMED');
  });

  it('is UNCONFIRMED for an OMNI business with no KYC request yet', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'NONE',
        hasActivePremiumSubscription: false,
      }),
    ).toBe('UNCONFIRMED');
  });

  it('is UNCONFIRMED for an OMNI business with a pending or rejected KYC request', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'PENDING',
        hasActivePremiumSubscription: false,
      }),
    ).toBe('UNCONFIRMED');
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'REJECTED',
        hasActivePremiumSubscription: false,
      }),
    ).toBe('UNCONFIRMED');
  });

  it('is CONFIRMED for an OMNI business with an approved KYC and no active premium subscription', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'APPROVED',
        hasActivePremiumSubscription: false,
      }),
    ).toBe('CONFIRMED');
  });

  it('is CERTIFIED for an OMNI business with an approved KYC and an active premium subscription', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'APPROVED',
        hasActivePremiumSubscription: true,
      }),
    ).toBe('CERTIFIED');
  });

  it('downgrades from CERTIFIED to CONFIRMED (not UNCONFIRMED) when the subscription lapses but KYC is still approved', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'APPROVED',
        hasActivePremiumSubscription: false,
      }),
    ).toBe('CONFIRMED');
  });

  it('is UNCONFIRMED once KYC is revoked, even if a premium subscription is still technically active', () => {
    expect(
      computeBusinessStatus({
        source: 'OMNI',
        kycStatus: 'REVOKED',
        hasActivePremiumSubscription: true,
      }),
    ).toBe('UNCONFIRMED');
  });
});
