export type BusinessStatus = 'UNCONFIRMED' | 'CONFIRMED' | 'CERTIFIED';

type BusinessStatusInput = {
  source: 'OMNI' | 'OSM';
  kycStatus: 'NONE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'REVOKED';
  /** Whether the business currently has a PREMIUM subscription with status ACTIVE and endDate in the future (or none, i.e. not yet expired). */
  hasActivePremiumSubscription: boolean;
};

/**
 * UNCONFIRMED -> CONFIRMED -> CERTIFIED is never stored directly: it is
 * always recomputed from the business's real KYC and subscription state,
 * so a subscription lapsing or a KYC approval being revoked downgrades the
 * status automatically on the next read, with nothing to reconcile.
 *
 * - OSM-sourced facilities are always UNCONFIRMED (OMNI never vouches for
 *   data it did not verify), regardless of any kycStatus value.
 * - OMNI businesses without an approved KYC review are UNCONFIRMED.
 * - An approved KYC review promotes a business to CONFIRMED.
 * - CERTIFIED additionally requires an active, paid PREMIUM subscription;
 *   losing that subscription (expiry, cancellation, payment failure) drops
 *   the business back to CONFIRMED, not to UNCONFIRMED -- KYC approval is
 *   unaffected by billing state.
 */
export function computeBusinessStatus(
  input: BusinessStatusInput,
): BusinessStatus {
  if (input.source === 'OSM') {
    return 'UNCONFIRMED';
  }
  if (input.kycStatus !== 'APPROVED') {
    return 'UNCONFIRMED';
  }
  if (input.hasActivePremiumSubscription) {
    return 'CERTIFIED';
  }
  return 'CONFIRMED';
}
