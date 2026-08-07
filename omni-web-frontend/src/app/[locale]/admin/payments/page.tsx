import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { Payment } from "@/types/payment";

export default async function AdminPaymentsPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const t = await getTranslations("admin.payments");
  const payments = await serverApiRequest<Payment[]>("/payments");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-500">
            <th className="py-2 pr-4">Utilisateur</th>
            <th className="py-2 pr-4">Formule</th>
            <th className="py-2 pr-4">Montant</th>
            <th className="py-2 pr-4">Méthode</th>
            <th className="py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {payments.map((payment) => (
            <tr key={payment.id} className="border-b border-neutral-900">
              <td className="py-2 pr-4 text-white">{payment.user?.name ?? payment.userId}</td>
              <td className="py-2 pr-4 text-neutral-300">{payment.plan?.name ?? "—"}</td>
              <td className="py-2 pr-4 text-neutral-300">
                {payment.amount} {payment.currency}
              </td>
              <td className="py-2 pr-4 text-neutral-300">{payment.method}</td>
              <td className="py-2 text-neutral-300">{payment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
