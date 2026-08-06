"use client";

import { loadClientEnv } from "@/lib/env/client";
import { apiRequest, type ApiRequestOptions } from "./api-client";

/**
 * Browser-side API client (Client Components). Relies on the browser's
 * own cookie jar (credentials: "include" in api-client.ts) -- no manual
 * cookie forwarding needed here, unlike server-client.ts.
 */
export function browserApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const { NEXT_PUBLIC_API_URL } = loadClientEnv();
  return apiRequest<T>(NEXT_PUBLIC_API_URL, path, options);
}
