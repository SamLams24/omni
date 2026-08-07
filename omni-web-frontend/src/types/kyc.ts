export type KycStatus = "NONE" | "PENDING" | "APPROVED" | "REJECTED" | "REVOKED";

export type KycRequest = {
  id: string;
  businessId: string;
  userId: string;
  status: KycStatus;
  documents: string[];
  rejectReason: string | null;
  reviewedById: string | null;
  reviewedAt: string | null;
  createdAt: string;
  updatedAt: string;
  business?: { id: string; name: string };
};
