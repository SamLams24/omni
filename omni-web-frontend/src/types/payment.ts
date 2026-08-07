export type PaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED"
  | "REFUNDED";

export type Payment = {
  id: string;
  userId: string;
  subscriptionId: string | null;
  planId: string;
  amount: string;
  currency: string;
  method: "USSD_PUSH" | "CHECKOUT";
  status: PaymentStatus;
  provider: string;
  createdAt: string;
  user?: { id: string; name: string; email: string };
  plan?: { id: string; name: string };
};
