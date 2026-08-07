import "server-only";
import { cookies } from "next/headers";
import { apiRequest, type ApiRequestOptions } from "./api-client";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Server-side API client (Server Components, Route Handlers, Server
 * Actions). fetch() on the server has no browser cookie jar, so the
 * incoming request's cookies are forwarded explicitly on every call --
 * this is how the backend's session cookie reaches omni-backend.
 *
 * Per ADR-004, mutating requests also echo the readable omni_csrf cookie
 * back as an X-CSRF-Token header, same as the browser client.
 */
export async function serverApiRequest<T>(
  path: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) {
    throw new Error("NEXT_PUBLIC_API_URL is not configured");
  }

  const cookieStore = await cookies();
  const cookieHeader = cookieStore.toString();
  const method = options.method ?? "GET";
  const csrfToken = cookieStore.get("omni_csrf")?.value;

  return apiRequest<T>(apiUrl, path, {
    cache: "no-store",
    ...options,
    headers: {
      ...(cookieHeader ? { cookie: cookieHeader } : {}),
      ...(MUTATING_METHODS.has(method) && csrfToken
        ? { "X-CSRF-Token": csrfToken }
        : {}),
      ...options.headers,
    },
  });
}
