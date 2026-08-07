"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { browserApiRequest } from "@/lib/api/browser-client";
import type { KycRequest } from "@/types/kyc";

export function KycTable({ initialRequests }: { initialRequests: KycRequest[] }) {
  const t = useTranslations("admin.kyc");
  const tStatus = useTranslations("seller.kyc.status");
  const [requests, setRequests] = useState(initialRequests);

  function applyUpdate(updated: KycRequest) {
    setRequests((current) => current.map((req) => (req.id === updated.id ? updated : req)));
  }

  const approveMutation = useMutation({
    mutationFn: (id: string) =>
      browserApiRequest<KycRequest>(`/kyc/requests/${id}/approve`, { method: "PATCH" }),
    onSuccess: applyUpdate,
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      browserApiRequest<KycRequest>(`/kyc/requests/${id}/reject`, {
        method: "PATCH",
        body: { reason },
      }),
    onSuccess: applyUpdate,
  });

  function handleReject(id: string) {
    const reason = window.prompt(t("rejectReasonPrompt"));
    if (reason) rejectMutation.mutate({ id, reason });
  }

  return (
    <table className="w-full border-collapse text-sm">
      <thead>
        <tr className="border-b border-neutral-800 text-left text-neutral-500">
          <th className="py-2 pr-4">Entreprise</th>
          <th className="py-2 pr-4">Statut</th>
          <th className="py-2" />
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <tr key={request.id} className="border-b border-neutral-900">
            <td className="py-2 pr-4 text-white">
              {request.business?.name ?? request.businessId}
            </td>
            <td className="py-2 pr-4 text-neutral-300">{tStatus(request.status)}</td>
            <td className="py-2">
              {request.status === "PENDING" ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => approveMutation.mutate(request.id)}
                    className="rounded-md border border-emerald-800 px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-950"
                  >
                    {t("approve")}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReject(request.id)}
                    className="rounded-md border border-red-800 px-2 py-1 text-xs text-red-300 hover:bg-red-950"
                  >
                    {t("reject")}
                  </button>
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
