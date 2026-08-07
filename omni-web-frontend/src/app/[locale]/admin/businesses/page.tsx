import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { Business } from "@/types/business";

export default async function AdminBusinessesPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN", "MODERATOR"]);
  const t = await getTranslations("admin.businesses");
  const tStatus = await getTranslations("business.status");
  const businesses = await serverApiRequest<Business[]>("/businesses/admin/all");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-800 text-left text-neutral-500">
            <th className="py-2 pr-4">Nom</th>
            <th className="py-2 pr-4">Téléphone</th>
            <th className="py-2 pr-4">Source</th>
            <th className="py-2">Statut</th>
          </tr>
        </thead>
        <tbody>
          {businesses.map((business) => (
            <tr key={business.id} className="border-b border-neutral-900">
              <td className="py-2 pr-4 text-white">{business.name}</td>
              <td className="py-2 pr-4 text-neutral-300">{business.phone}</td>
              <td className="py-2 pr-4 text-neutral-300">{business.source}</td>
              <td className="py-2 text-neutral-300">{tStatus(business.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
