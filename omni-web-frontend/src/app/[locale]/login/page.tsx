"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@/i18n/navigation";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ApiErrorMessage } from "@/components/feedback/api-error-message";
import { CURRENT_USER_QUERY_KEY } from "@/hooks/use-current-user";
import type { CurrentUser } from "@/types/auth";

export default function LoginPage() {
  const t = useTranslations("auth.login");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      browserApiRequest<{ user: CurrentUser }>("/auth/login", {
        method: "POST",
        body: { email, password },
      }),
    onSuccess: (data) => {
      queryClient.setQueryData(CURRENT_USER_QUERY_KEY, data.user);
      router.push("/");
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-6 py-16">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-neutral-400">{t("subtitle")}</p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("email")}
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("password")}
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        {mutation.isError ? <ApiErrorMessage error={mutation.error} /> : null}
        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
        >
          {mutation.isPending ? t("submitting") : t("submit")}
        </button>
      </form>
      <p className="text-sm text-neutral-400">
        {t("noAccount")}{" "}
        <Link href="/register" className="text-white underline">
          {t("registerLink")}
        </Link>
      </p>
    </div>
  );
}
