import { validateEnv } from './env.validation';

const VALID: Record<string, string> = {
  DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/omni_dev',
  FRONTEND_URL: 'http://localhost:3000',
  CORS_ORIGINS: 'http://localhost:3000',
  JWT_ACCESS_SECRET: 'a-sufficiently-long-access-secret',
  JWT_REFRESH_SECRET: 'a-sufficiently-long-refresh-secret',
};

describe('validateEnv', () => {
  it('accepts a minimal valid configuration and fills in defaults', () => {
    const env = validateEnv(VALID);

    expect(env.PORT).toBe(4000);
    expect(env.API_PREFIX).toBe('api');
    expect(env.NODE_ENV).toBe('development');
    expect(env.SWAGGER_ENABLED).toBe(true);
  });

  it('throws when DATABASE_URL is missing', () => {
    const rest = Object.fromEntries(
      Object.entries(VALID).filter(([key]) => key !== 'DATABASE_URL'),
    );
    expect(() => validateEnv(rest)).toThrow(/refusing to start/);
  });

  it('throws when a JWT secret is too short', () => {
    expect(() => validateEnv({ ...VALID, JWT_ACCESS_SECRET: 'short' })).toThrow(
      /refusing to start/,
    );
  });

  it('coerces boolean-like strings for COOKIE_SECURE and SWAGGER_ENABLED', () => {
    const env = validateEnv({
      ...VALID,
      COOKIE_SECURE: 'true',
      SWAGGER_ENABLED: 'false',
    });
    expect(env.COOKIE_SECURE).toBe(true);
    expect(env.SWAGGER_ENABLED).toBe(false);
  });

  it('rejects an invalid NODE_ENV value', () => {
    expect(() => validateEnv({ ...VALID, NODE_ENV: 'staging' })).toThrow();
  });
});
