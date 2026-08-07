import { requireUser } from "@/lib/auth/require-user";
import { KycForm } from "./kyc-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function SellerKycPage({ params }: PageProps) {
  await requireUser(["SELLER", "ADMIN", "SUPER_ADMIN"]);
  const { id } = await params;
  return <KycForm businessId={id} />;
}
