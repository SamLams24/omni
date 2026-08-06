import { ApiError, ApiNetworkError } from "./api-error";

const DEFAULT_TIMEOUT_MS = 10_000;

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Forwarded to fetch(); the server client sets "no-store" by default. */
  cache?: RequestCache;
};

type ErrorResponseBody = {
  statusCode?: number;
  code?: string;
  message?: string;
  requestId?: string;
  details?: unknown;
};

/**
 * Shared fetch wrapper used by both the server and browser API clients.
 * Never called directly from feature code -- go through server-client.ts
 * (Server Components / Route Handlers) or browser-client.ts (Client
 * Components) so cookie/credentials handling stays consistent.
 */
export async function apiRequest<T>(
  baseUrl: string,
  path: string,
  { method = "GET", body, headers, signal, timeoutMs = DEFAULT_TIMEOUT_MS, cache }: ApiRequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const combinedSignal = signal
    ? AbortSignal.any([signal, controller.signal])
    : controller.signal;

  const requestHeaders = new Headers(headers);
  requestHeaders.set("Accept", "application/json");
  if (body) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const init: RequestInit = {
    method,
    headers: requestHeaders,
    credentials: "include",
    signal: combinedSignal,
  };
  if (body) {
    init.body = JSON.stringify(body);
  }
  if (cache) {
    init.cache = cache;
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, init);
  } catch (cause) {
    throw new ApiNetworkError(cause);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text();

  if (!response.ok) {
    const errorBody = (payload ?? {}) as ErrorResponseBody;
    throw new ApiError(errorBody.message ?? response.statusText, {
      status: response.status,
      code: errorBody.code,
      requestId: errorBody.requestId ?? response.headers.get("x-request-id") ?? undefined,
      details: errorBody.details,
    });
  }

  return payload as T;
}
