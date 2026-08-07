import { getTranslations } from "next-intl/server";
import { requireUser } from "@/lib/auth/require-user";
import { serverApiRequest } from "@/lib/api/server-client";
import type { UserSummary } from "@/types/user";
import { UsersTable } from "./users-table";

export default async function AdminUsersPage() {
  await requireUser(["SUPER_ADMIN", "ADMIN"]);
  const t = await getTranslations("admin.users");
  const users = await serverApiRequest<UserSummary[]>("/users");

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
      <UsersTable initialUsers={users} />
    </main>
  );
}
