import { z } from 'zod';

/**
 * All required server environment variables, validated once at startup.
 * The app refuses to start when a required variable is missing or
 * malformed -- see main.ts, which calls this before creating the Nest
 * application context.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('api'),
  API_VERSION: z.string().default('v1'),

  DATABASE_URL: z.url(),

  FRONTEND_URL: z.url(),
  CORS_ORIGINS: z.string().min(1),

  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),

  // z.coerce.boolean() would treat the *string* "false" as truthy (plain
  // JS `Boolean("false") === true`) -- z.stringbool() parses "true"/"false"
  // (and a few common aliases) explicitly instead.
  COOKIE_SECURE: z.stringbool().default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  COOKIE_DOMAIN: z.string().optional(),

  FEDAPAY_ENVIRONMENT: z.enum(['sandbox', 'live']).default('sandbox'),
  FEDAPAY_SECRET_KEY: z.string().optional(),
  FEDAPAY_PUBLIC_KEY: z.string().optional(),
  FEDAPAY_WEBHOOK_SECRET: z.string().optional(),

  OVERPASS_API_URL: z.url().default('https://overpass-api.de/api/interpreter'),
  OSM_CACHE_TTL_SECONDS: z.coerce.number().int().positive().default(300),

  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('debug'),
  SWAGGER_ENABLED: z.stringbool().default(true),

  // Auth0/OIDC -- optional: social login is scaffolded but non-functional
  // without real tenant credentials. See docs/api/authentication.md.
  AUTH0_DOMAIN: z.string().optional(),
  AUTH0_CLIENT_ID: z.string().optional(),
  AUTH0_CLIENT_SECRET: z.string().optional(),
  AUTH0_CALLBACK_URL: z.url().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(
      `Invalid environment configuration, refusing to start:\n${issues}`,
    );
  }
  return parsed.data;
}
