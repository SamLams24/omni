"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { browserApiRequest } from "@/lib/api/browser-client";
import type { UserSummary } from "@/types/user";

export function UsersTable({ initialUsers }: { initialUsers: UserSummary[] }) {
  const t = useTranslations("admin.users");
  const [users, setUsers] = useState(initialUsers);

  const mutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      browserApiRequest<UserSummary>(`/users/${id}/${active ? "reactivate" : "suspend"}`, {
        method: "PATCH",
      }),
    onSuccess: (updated) => {
      setUsers((current) => current.map((user) => (user.id === updated.id ? updated : user)));
    },
  });

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-800 text-left text-neutral-500">
          <th className="py-2 pr-4">Nom</th>
          <th className="py-2 pr-4">Email</th>
          <th className="py-2 pr-4">Rôles</th>
          <th className="py-2 pr-4">Statut</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} className="border-b border-neutral-900">
            <td className="py-2 pr-4 text-white">{user.name}</td>
            <td className="py-2 pr-4 text-neutral-300">{user.email}</td>
            <td className="py-2 pr-4 text-neutral-300">{user.roles.join(", ")}</td>
            <td className="py-2 pr-4">
              <span className={user.isActive ? "text-emerald-400" : "text-red-400"}>
                {user.isActive ? t("active") : t("suspended")}
              </span>
            </td>
            <td className="py-2">
              <button
                type="button"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ id: user.id, active: !user.isActive })}
                className="rounded-md border border-neutral-700 px-2 py-1 text-xs text-white hover:bg-neutral-900 disabled:opacity-60"
              >
                {user.isActive ? t("suspend") : t("reactivate")}
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
