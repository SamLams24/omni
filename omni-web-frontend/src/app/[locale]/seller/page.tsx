import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import { Link } from "@/i18n/navigation";
import type { Business } from "@/types/business";
import type { Subscription } from "@/types/subscription";

export default async function SellerDashboardPage() {
  await requireUser(["SELLER", "ADMIN", "SUPER_ADMIN"]);
  const t = await getTranslations("seller.dashboard");
  const tStatus = await getTranslations("business.status");

  const [businesses, subscriptions] = await Promise.all([
    serverApiRequest<Business[]>("/businesses/mine"),
    serverApiRequest<Subscription[]>("/subscriptions/mine"),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-white">{t("myBusinesses")}</h2>
          <Link
            href="/seller/business/new"
            className="rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {t("createBusiness")}
          </Link>
        </div>
        {businesses.length === 0 ? (
          <p className="text-neutral-400">{t("noBusinesses")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {businesses.map((business) => (
              <li
                key={business.id}
                className="flex items-center justify-between rounded-md border border-neutral-800 px-4 py-3"
              >
                <div>
                  <p className="text-white">{business.name}</p>
                  <p className="text-sm text-neutral-500">{tStatus(business.status)}</p>
                </div>
                <div className="flex gap-3 text-sm">
                  <Link
                    href={`/seller/business/${business.id}/kyc`}
                    className="text-neutral-300 underline hover:text-white"
                  >
                    KYC
                  </Link>
                  <Link
                    href={`/seller/business/${business.id}/subscription`}
                    className="text-neutral-300 underline hover:text-white"
                  >
                    {t("mySubscriptions")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium text-white">{t("mySubscriptions")}</h2>
        {subscriptions.length === 0 ? (
          <p className="text-neutral-400">{t("noSubscriptions")}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {subscriptions.map((subscription) => (
              <li
                key={subscription.id}
                className="rounded-md border border-neutral-800 px-4 py-3 text-sm text-neutral-300"
              >
                {subscription.business?.name ?? subscription.businessId} —{" "}
                {subscription.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
