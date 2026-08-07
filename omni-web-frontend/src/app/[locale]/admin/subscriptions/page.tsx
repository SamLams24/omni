import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { Subscription } from "@/types/subscription";

export default async function AdminSubscriptionsPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const t = await getTranslations("admin.subscriptions");
  const subscriptions = await serverApiRequest<Subscription[]>("/subscriptions");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-500">
            <th className="py-2 pr-4">Entreprise</th>
            <th className="py-2 pr-4">Formule</th>
            <th className="py-2 pr-4">Statut</th>
            <th className="py-2">Expire le</th>
          </tr>
        </thead>
        <tbody>
          {subscriptions.map((subscription) => (
            <tr key={subscription.id} className="border-b border-neutral-900">
              <td className="py-2 pr-4 text-white">
                {subscription.business?.name ?? subscription.businessId ?? "—"}
              </td>
              <td className="py-2 pr-4 text-neutral-300">{subscription.plan?.name ?? "—"}</td>
              <td className="py-2 pr-4 text-neutral-300">{subscription.status}</td>
              <td className="py-2 text-neutral-300">
                {subscription.endDate ? new Date(subscription.endDate).toLocaleDateString() : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
