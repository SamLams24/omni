"use client";

import { useQuery } from "@tanstack/react-query";
import { browserApiRequest } from "@/lib/api/browser-client";
import { ApiError } from "@/lib/api/api-error";
import type { CurrentUser } from "@/types/auth";

export const CURRENT_USER_QUERY_KEY = ["auth", "me"] as const;

export function useCurrentUser() {
  return useQuery({
    queryKey: CURRENT_USER_QUERY_KEY,
    queryFn: async () => {
      try {
        return await browserApiRequest<CurrentUser>("/auth/me");
      } catch (error) {
        if (error instanceof ApiError && error.isUnauthorized) {
          return null;
        }
        throw error;
      }
    },
  });
}
