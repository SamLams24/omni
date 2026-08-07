import "server-only";
import { serverApiRequest } from "@/lib/api/server-client";
import { ApiError, ApiNetworkError } from "@/lib/api/api-error";
import type { CurrentUser } from "@/types/auth";

/**
 * Server Component / layout helper: returns the current user from their
 * session cookie, or null if there isn't one (no session is the normal,
 * expected outcome for a logged-out visitor -- not an error to surface).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await serverApiRequest<CurrentUser>("/auth/me");
  } catch (error) {
    if (error instanceof ApiError || error instanceof ApiNetworkError) {
      return null;
    }
    throw error;
  }
}
