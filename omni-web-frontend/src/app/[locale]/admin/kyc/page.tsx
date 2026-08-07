import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { KycRequest } from "@/types/kyc";
import { KycTable } from "./kyc-table";

export default async function AdminKycPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
  const t = await getTranslations("admin.kyc");
  const requests = await serverApiRequest<KycRequest[]>("/kyc/requests");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <KycTable initialRequests={requests} />
    </main>
  );
}
