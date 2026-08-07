import { ErrorState } from "@/components/feedback/error-state";

/**
 * Renders when notFound() is called within a valid-locale route (e.g. a
 * business that doesn't exist), or for any unmatched path under /fr or
 * /en. Nested inside [locale]/layout.tsx, so translations are available.
 */
export default function LocaleNotFound() {
  return <ErrorState status={404} />;
}
