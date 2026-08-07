"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ApiErrorMessage } from "@/components/feedback/api-error-message";
import type { KycRequest } from "@/types/kyc";

export function KycForm({ businessId }: { businessId: string }) {
  const t = useTranslations("seller.kyc");
  const [documentsText, setDocumentsText] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      browserApiRequest<KycRequest>("/kyc/requests", {
        method: "POST",
        body: {
          businessId,
          documents: documentsText
            .split("\n")
            .map((line) => line.trim())
            .filter(Boolean),
        },
      }),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold text-white">{t("title")}</h1>
        <p className="mt-1 text-neutral-400">{t("subtitle")}</p>
      </div>
      {mutation.isSuccess ? (
        <p className="rounded-md border border-emerald-800 bg-emerald-950 px-4 py-3 text-emerald-300">
          {t(`status.${mutation.data.status}`)}
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-neutral-300">
            {t("documents")}
            <textarea
              required
              rows={5}
              value={documentsText}
              onChange={(event) => setDocumentsText(event.target.value)}
              placeholder="cni-recto.jpg&#10;cni-verso.jpg"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
            />
            <span className="text-xs text-neutral-500">{t("documentsHint")}</span>
          </label>
          {mutation.isError ? <ApiErrorMessage error={mutation.error} /> : null}
          <button
            type="submit"
            disabled={mutation.isPending}
            className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
          >
            {t("submit")}
          </button>
        </form>
      )}
    </main>
  );
}
