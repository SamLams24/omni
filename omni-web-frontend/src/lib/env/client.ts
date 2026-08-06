import { z } from "zod";

/**
 * Client-side environment variables. Only NEXT_PUBLIC_* values may live
 * here -- this module is imported from Client Components, so anything
 * without that prefix would either be undefined or, worse, accidentally
 * bundled if Next.js inlining rules ever change.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_API_URL: z.url(),
  NEXT_PUBLIC_MAP_DEFAULT_LAT: z.coerce.number(),
  NEXT_PUBLIC_MAP_DEFAULT_LON: z.coerce.number(),
  NEXT_PUBLIC_MAP_DEFAULT_ZOOM: z.coerce.number(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;

export function loadClientEnv(): ClientEnv {
  const parsed = clientEnvSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_MAP_DEFAULT_LAT: process.env.NEXT_PUBLIC_MAP_DEFAULT_LAT,
    NEXT_PUBLIC_MAP_DEFAULT_LON: process.env.NEXT_PUBLIC_MAP_DEFAULT_LON,
    NEXT_PUBLIC_MAP_DEFAULT_ZOOM: process.env.NEXT_PUBLIC_MAP_DEFAULT_ZOOM,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid client environment variables: ${parsed.error.message}`,
    );
  }

  return parsed.data;
}
