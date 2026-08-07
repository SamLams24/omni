import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { Link } from "@/i18n/navigation";

export default async function AdminDashboardPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const t = await getTranslations("admin.dashboard");

  const sections: { href: string; label: string }[] = [
    { href: "/admin/users", label: t("users") },
    { href: "/admin/businesses", label: t("businesses") },
    { href: "/admin/kyc", label: t("kyc") },
    { href: "/admin/subscriptions", label: t("subscriptions") },
    { href: "/admin/payments", label: t("payments") },
  ];

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {sections.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="block rounded-md border border-neutral-800 px-4 py-6 text-center text-white hover:border-neutral-600"
            >
              {section.label}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
