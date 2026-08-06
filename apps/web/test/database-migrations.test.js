import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  applyMigrationPlan,
  buildMigrationPlan,
  checksumMigration,
  discoverMigrations,
} from '../scripts/migrate.mjs';
import { assertDevelopmentSeedAllowed } from '../scripts/seed-development.mjs';

const readSource = (relativePath) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

describe('database migrations', () => {
  it('discovers ordered immutable SQL migrations', async () => {
    const migrations = await discoverMigrations();

    expect(migrations.map(({ filename }) => filename)).toEqual([
      '0001_baseline.sql',
      '0002_product_timestamps.sql',
      '0003_transactions_reference_unique.sql',
      '0004_wallet_deposit_intents.sql',
      '0005_fedapay_webhook_events.sql',
      '0006_vendor_verification.sql',
    ]);
    expect(migrations[0].checksum).toBe(
      checksumMigration(migrations[0].sql),
    );
  });

  it('plans only unapplied migrations', () => {
    const migrations = [
      { version: '0001', checksum: 'one' },
      { version: '0002', checksum: 'two' },
    ];

    expect(
      buildMigrationPlan(migrations, [
        { version: '0001', checksum: 'one' },
      ]),
    ).toEqual([{ version: '0002', checksum: 'two' }]);
  });

  it('rejects edited or missing applied migrations', () => {
    expect(() =>
      buildMigrationPlan(
        [{ version: '0001', checksum: 'new' }],
        [{ version: '0001', checksum: 'old' }],
      ),
    ).toThrow('Checksum mismatch');

    expect(() =>
      buildMigrationPlan(
        [{ version: '0001', checksum: 'one' }],
        [{ version: '0002', checksum: 'two' }],
      ),
    ).toThrow('missing from the repository');
  });

  it('rolls back a failed migration without recording it', async () => {
    const query = vi.fn(async (statement) => {
      if (statement === 'INVALID SQL') throw new Error('database error');
      return { rows: [] };
    });

    await expect(
      applyMigrationPlan(
        { query },
        [{
          version: '0001',
          name: 'baseline',
          filename: '0001_baseline.sql',
          checksum: 'checksum',
          sql: 'INVALID SQL',
        }],
      ),
    ).rejects.toThrow('0001_baseline.sql failed');

    expect(query.mock.calls.map(([statement]) => statement)).toEqual([
      'BEGIN',
      'INVALID SQL',
      'ROLLBACK',
    ]);
  });

  it('keeps schema and development data separate', () => {
    const schema = readSource('../db/migrations/0001_baseline.sql');
    const seed = readSource('../db/seeds/development.sql');

    expect(schema).not.toContain('kofi@vendor.omni');
    expect(schema).not.toContain('Ama Market');
    expect(seed).toContain('kofi@vendor.omni');
    expect(schema.indexOf('CREATE TABLE IF NOT EXISTS carts')).toBeLessThan(
      schema.indexOf('CREATE TABLE IF NOT EXISTS delivery_requests'),
    );
    expect(
      [...schema.matchAll(/CREATE TABLE IF NOT EXISTS (\w+)/g)]
        .map((match) => match[1]),
    ).toEqual([
      'users',
      'vendors',
      'facilities',
      'products',
      'carts',
      'availability_requests',
      'messages',
      'favorites',
      'notifications',
      'reviews',
      'delivery_profiles',
      'delivery_vehicles',
      'delivery_planned_trips',
      'delivery_requests',
      'wallets',
      'transactions',
      'escrow_holds',
      'subscriptions',
      'proximity_log',
    ]);
    expect(schema).toContain(
      'sender_id UUID NOT NULL REFERENCES users(id)',
    );
  });

  it('leaves no competing schema setup entrypoint', () => {
    const scriptsDirectory = resolve(process.cwd(), 'scripts');
    const scripts = readdirSync(scriptsDirectory).sort();

    expect(scripts).toEqual([
      'migrate.mjs',
      'seed-development.mjs',
    ]);
  });

  it('requires explicit opt-in and refuses production seeding', () => {
    expect(() =>
      assertDevelopmentSeedAllowed({
        NODE_ENV: 'production',
        ALLOW_DEVELOPMENT_SEED: 'true',
        DATABASE_URL: 'postgresql://example',
      }),
    ).toThrow('Development seed disabled');

    expect(() =>
      assertDevelopmentSeedAllowed({
        NODE_ENV: 'development',
        ALLOW_DEVELOPMENT_SEED: 'false',
        DATABASE_URL: 'postgresql://example',
      }),
    ).toThrow('Development seed disabled');

    expect(() =>
      assertDevelopmentSeedAllowed({
        NODE_ENV: 'development',
        ALLOW_DEVELOPMENT_SEED: 'true',
        DATABASE_URL: 'postgresql://example',
      }),
    ).not.toThrow();
  });
});
