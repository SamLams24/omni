export type SubscriptionTier = "FREE" | "PREMIUM";
export type SubscriptionStatus = "PENDING" | "ACTIVE" | "PAST_DUE" | "CANCELED" | "EXPIRED";

export type SubscriptionPlan = {
  id: string;
  tier: SubscriptionTier;
  name: string;
  priceAmount: string;
  priceCurrency: string;
  createdAt: string;
};

export type Subscription = {
  id: string;
  userId: string;
  businessId: string | null;
  planId: string | null;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string | null;
  createdAt: string;
  business?: { id: string; name: string } | null;
  plan?: { id: string; name: string; priceAmount: string; priceCurrency: string } | null;
};

export type InitiatePaymentResult = {
  paymentId: string;
  flow: "mobile_money_push" | "hosted_checkout";
  checkoutUrl: string;
};
