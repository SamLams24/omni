"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/error-state";

type ApiLikeError = Error & {
  status?: number;
  requestId?: string;
  digest?: string;
};

type LocaleErrorProps = {
  error: ApiLikeError;
  retry: () => void;
};

/**
 * Catch-all boundary for uncaught exceptions within a locale segment.
 * Custom properties (status/requestId) on an ApiError survive here only
 * when the throw happened client-side -- Next.js strips them from errors
 * that cross the Server Component -> Client Component boundary in
 * production, keeping just message + digest. Server Components that call
 * the API should therefore catch ApiError themselves and render
 * <ErrorState> inline with the real status; this boundary is the safety
 * net for everything else, which renders as a generic 500.
 */
export default function LocaleError({ error, retry }: LocaleErrorProps) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      status={error.status}
      requestId={error.requestId ?? error.digest}
      onRetry={retry}
    />
  );
}
