"use client";

import { useTranslations } from "next-intl";
import { ApiError } from "@/lib/api/api-error";

const KNOWN_CODES = new Set([
  "AUTH_INVALID_CREDENTIALS",
  "AUTH_USER_DISABLED",
  "AUTH_SESSION_EXPIRED",
  "AUTH_FORBIDDEN",
  "USER_ALREADY_EXISTS",
  "VALIDATION_ERROR",
  "BUSINESS_NOT_FOUND",
  "KYC_ALREADY_APPROVED",
  "KYC_REQUEST_NOT_FOUND",
  "SUBSCRIPTION_NOT_FOUND",
  "SUBSCRIPTION_NOT_CANCELABLE",
  "PAYMENT_FAILED",
  "PAYMENT_PLAN_UNKNOWN",
]);

/**
 * Renders a translated message for an ApiError, keyed by its stable `code`
 * -- never the raw `message` string the backend returns, which is French
 * only and meant for logs/debugging (see error-codes.ts).
 */
export function ApiErrorMessage({ error }: { error: unknown }) {
  const t = useTranslations("errors.codes");
  if (!(error instanceof ApiError)) {
    return <p className="text-sm text-red-400">{t("GENERIC")}</p>;
  }
  const key = KNOWN_CODES.has(error.code) ? error.code : "GENERIC";
  return <p className="text-sm text-red-400">{t(key)}</p>;
}
