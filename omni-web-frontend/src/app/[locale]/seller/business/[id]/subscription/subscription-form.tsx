"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ApiErrorMessage } from "@/components/feedback/api-error-message";
import type { SubscriptionPlan, InitiatePaymentResult } from "@/types/subscription";

export function SubscriptionForm({
  businessId,
  plans,
}: {
  businessId: string;
  plans: SubscriptionPlan[];
}) {
  const t = useTranslations("seller.subscription");
  const [planId, setPlanId] = useState(plans[0]?.id ?? "");
  const [phoneNumber, setPhoneNumber] = useState("");

  const mutation = useMutation({
    mutationFn: () =>
      browserApiRequest<InitiatePaymentResult>("/payments/subscriptions", {
        method: "POST",
        body: { businessId, planId, phoneNumber },
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
        <div className="rounded-md border border-emerald-800 bg-emerald-950 px-4 py-3 text-emerald-300">
          <p>
            {mutation.data.flow === "mobile_money_push" ? t("flowPush") : t("flowCheckout")}
          </p>
          <a
            href={mutation.data.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block rounded-md bg-white px-3 py-1.5 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {t("openCheckout")}
          </a>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm text-neutral-300">
            {t("plan")}
            <select
              value={planId}
              onChange={(event) => setPlanId(event.target.value)}
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
            >
              {plans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name} — {plan.priceAmount} {plan.priceCurrency}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm text-neutral-300">
            {t("phoneNumber")}
            <input
              required
              value={phoneNumber}
              onChange={(event) => setPhoneNumber(event.target.value)}
              placeholder="90123456"
              className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-white outline-none focus:border-white"
            />
          </label>
          {mutation.isError ? <ApiErrorMessage error={mutation.error} /> : null}
          <button
            type="submit"
            disabled={mutation.isPending || !planId}
            className="mt-2 rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200 disabled:opacity-60"
          >
            {t("subscribe")}
          </button>
        </form>
      )}
    </main>
  );
}
