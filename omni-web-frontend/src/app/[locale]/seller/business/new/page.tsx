"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "@/i18n/navigation";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ApiErrorMessage } from "@/components/feedback/api-error-message";
import type { Business } from "@/types/business";

export default function CreateBusinessPage() {
  const t = useTranslations("seller.business");
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [description, setDescription] = useState("");
  const [address, setAddress] = useState("");
  const [neighborhood, setNeighborhood] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      browserApiRequest<Business>("/businesses", {
        method: "POST",
        body: {
          name,
          phone,
          email: email || undefined,
          description: description || undefined,
          address: address || undefined,
          neighborhood: neighborhood || undefined,
        },
      }),
    onSuccess: () => router.push("/seller"),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate();
  }

  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-white">{t("createTitle")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("name")}
          <input
            required
            minLength={2}
            value={name}
            onChange={(event) => setName(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("phone")}
          <input
            required
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="+22890000000"
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("email")}
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("description")}
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("address")}
          <input
            value={address}
            onChange={(event) => setAddress(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-neutral-300">
          {t("neighborhood")}
          <input
            value={neighborhood}
            onChange={(event) => setNeighborhood(event.target.value)}
            className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
          />
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
    </main>
  );
}
