import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";

export default async function ProfilePage() {
  const user = await requireUser();
  const t = await getTranslations("buyer.profile");

  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
        <dt className="text-neutral-500">Nom</dt>
        <dd className="text-white">{user.name}</dd>
        <dt className="text-neutral-500">Email</dt>
        <dd className="text-white">{user.email}</dd>
        <dt className="text-neutral-500">Roles</dt>
        <dd className="text-white">{user.roles.join(", ")}</dd>
      </dl>
    </main>
  );
}
