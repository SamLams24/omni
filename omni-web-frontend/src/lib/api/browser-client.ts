"use client";

import { loadClientEnv } from "@/lib/env/client";
import { apiRequest, type ApiRequestOptions } from "./api-client";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function readCsrfCookie(): string | undefined {
  const match = /(?:^|; )omni_csrf=([^;]+)/.exec(document.cookie);
  return match?.[1] ? decodeURIComponent(match[1]) : undefined;
}

/**
 * Browser-side API client (Client Components). Relies on the browser's
 * own cookie jar (credentials: "include" in api-client.ts) -- no manual
 * cookie forwarding needed here, unlike server-client.ts.
 *
 * Per ADR-004 (double-submit CSRF), every mutating request must echo the
 * readable omni_csrf cookie back as an X-CSRF-Token header -- done here,
 * once, so individual call sites never have to remember it.
 */
export function browserApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { NEXT_PUBLIC_API_URL } = loadClientEnv();
  const method = options.method ?? "GET";

  if (MUTATING_METHODS.has(method)) {
    const csrfToken = readCsrfCookie();
    if (csrfToken) {
      const headers = new Headers(options.headers);
      headers.set("X-CSRF-Token", csrfToken);
      options = { ...options, headers };
    }
  }

  return apiRequest<T>(NEXT_PUBLIC_API_URL, path, options);
}
