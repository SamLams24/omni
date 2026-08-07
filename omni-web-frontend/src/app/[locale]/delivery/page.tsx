import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { Link } from "@/i18n/navigation";

// Visual shell only, ported from apps/web/src/app/delivery/layout.jsx
// (sidebar with dashboard/history/settings nav + a link back to the map).
// The delivery matching/dispatch workflow itself is real, non-trivial
// backend logic (Haversine matching, tier caps, conflict detection) that
// this mission does not migrate -- see docs/migration/priority-features-audit.md.
// Never fake or simulate delivery data here.
const NAV_ITEMS = ["dashboard", "history", "settings"] as const;

export default async function DeliveryPage() {
  await requireUser(["DELIVERY", "ADMIN", "SUPER_ADMIN"]);
  const t = await getTranslations("delivery");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex w-full max-w-4xl gap-6 px-6 py-12">
      <aside className="w-48 shrink-0 rounded-md border border-neutral-800">
        <div className="border-b border-neutral-800 px-4 py-3">
          <p className="text-sm font-medium text-white">{t("title")}</p>
        </div>
        <Link
          href="/map"
          className="block border-b border-neutral-800 px-4 py-2 text-sm text-emerald-400/80 hover:text-emerald-400"
        >
          {t("title")} — map
        </Link>
        <nav className="flex flex-col py-2">
          {NAV_ITEMS.map((item) => (
            <span
              key={item}
              className="cursor-not-allowed px-4 py-2 text-sm capitalize text-neutral-600"
            >
              {item}
            </span>
          ))}
        </nav>
      </aside>
      <section className="flex-1 rounded-md border border-neutral-800 px-6 py-12 text-center">
        <p className="text-neutral-300">{tCommon("comingSoon")}</p>
      </section>
    </main>
  );
}
