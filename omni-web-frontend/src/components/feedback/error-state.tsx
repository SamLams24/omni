"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";

export type KnownErrorStatus =
  | 400
  | 401
  | 403
  | 404
  | 409
  | 422
  | 429
  | 500
  | 503;

const KNOWN_STATUSES: readonly KnownErrorStatus[] = [
  400, 401, 403, 404, 409, 422, 429, 500, 503,
];

function resolveStatusKey(status: number | undefined): KnownErrorStatus | "generic" {
  if (status !== undefined && (KNOWN_STATUSES as readonly number[]).includes(status)) {
    return status as KnownErrorStatus;
  }
  return "generic";
}

type ErrorStateProps = {
  status?: number | undefined;
  requestId?: string | undefined;
  onRetry?: (() => void) | undefined;
};

/**
 * Renders dedicated copy per HTTP status (mission requirement: 400, 401,
 * 403, 404, 409, 422, 429, 500, 503 each get their own UX, not a single
 * generic "something went wrong"). Falls back to a generic message for
 * anything unlisted (e.g. a bare network failure).
 */
export function ErrorState({ status, requestId, onRetry }: ErrorStateProps) {
  const t = useTranslations("errors");
  const key = resolveStatusKey(status);
  const showLogin = status === 401;

  return (
    <div
      role="alert"
      className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 py-16 text-center"
    >
      <p className="text-sm font-medium uppercase tracking-wide text-neutral-400">
        {status ?? t("generic.code")}
      </p>
      <h1 className="text-2xl font-semibold text-white">{t(`${key}.title`)}</h1>
      <p className="max-w-md text-neutral-400">{t(`${key}.description`)}</p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {t("actions.retry")}
          </button>
        ) : null}
        {showLogin ? (
          <Link
            href="/login"
            className="rounded-md bg-white px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-neutral-200"
          >
            {t("actions.login")}
          </Link>
        ) : null}
        <Link
          href="/"
          className="rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-900"
        >
          {t("actions.goHome")}
        </Link>
      </div>
      {requestId ? (
        <p className="mt-4 text-xs text-neutral-600">
          {t("actions.requestId", { requestId })}
        </p>
      ) : null}
    </div>
  );
}
