export type KycStatus = "none" | "pending" | "approved" | "rejected" | "revoked";
export type VerificationStatus = "non_verifiee" | "verifiee" | "certifiee";
export type VendorSource = "omni" | "osm";

export interface VendorVerificationInput {
  source: VendorSource;
  claimed: boolean;
  kycStatus: KycStatus | null | undefined;
  subscriptionActive: boolean;
}

/**
 * Single source of truth for the three-state vendor verification status.
 * Never persist the result — always derive it at read time from raw facts
 * (kyc_status, claimed, subscription_active) so certification can never
 * outlive an expired/cancelled subscription or a revoked KYC.
 */
export function deriveVerificationStatus(
  input: VendorVerificationInput,
): VerificationStatus {
  if (input.source === "osm" || !input.claimed) {
    return "non_verifiee";
  }
  if (input.kycStatus !== "approved") {
    return "non_verifiee";
  }
  return input.subscriptionActive ? "certifiee" : "verifiee";
}

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  non_verifiee: "Non vérifiée",
  verifiee: "Vérifiée",
  certifiee: "Certifiée",
};
