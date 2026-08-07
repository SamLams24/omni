import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { SubscriptionPlan } from "@/types/subscription";
import { SubscriptionForm } from "./subscription-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function SellerSubscriptionPage({ params }: PageProps) {
  await requireUser(["SELLER", "ADMIN", "SUPER_ADMIN"]);
  const { id } = await params;
  const plans = await serverApiRequest<SubscriptionPlan[]>("/subscriptions/plans");
  return <SubscriptionForm businessId={id} plans={plans} />;
}
