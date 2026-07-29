import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

const MIGRATION_FILE = /^(?<version>\d{4})_(?<name>[a-z0-9_]+)\.sql$/;
const LOCK_NAME = 'omni:schema-migrations';
const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const defaultMigrationsDirectory = resolve(scriptDirectory, '../db/migrations');

neonConfig.webSocketConstructor = ws;

export function checksumMigration(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function discoverMigrations(
  migrationsDirectory = defaultMigrationsDirectory,
) {
  const entries = await readdir(migrationsDirectory, { withFileTypes: true });
  const migrations = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.sql')) continue;

    const match = entry.name.match(MIGRATION_FILE);
    if (!match) {
      throw new Error(`Invalid migration filename: ${entry.name}`);
    }

    const sql = await readFile(resolve(migrationsDirectory, entry.name), 'utf8');
    migrations.push({
      version: match.groups.version,
      name: match.groups.name,
      filename: entry.name,
      checksum: checksumMigration(sql),
      sql,
    });
  }

  migrations.sort((left, right) => left.version.localeCompare(right.version));
  const versions = migrations.map(({ version }) => version);
  if (new Set(versions).size !== versions.length) {
    throw new Error('Migration versions must be unique');
  }

  return migrations;
}

export function buildMigrationPlan(migrations, appliedRows) {
  const available = new Map(
    migrations.map((migration) => [migration.version, migration]),
  );
  const applied = new Map(
    appliedRows.map((migration) => [migration.version, migration]),
  );

  for (const migration of appliedRows) {
    const local = available.get(migration.version);
    if (!local) {
      throw new Error(
        `Database migration ${migration.version} is missing from the repository`,
      );
    }
    if (local.checksum !== migration.checksum) {
      throw new Error(
        `Checksum mismatch for applied migration ${migration.version}`,
      );
    }
  }

  return migrations.filter((migration) => !applied.has(migration.version));
}

async function readAppliedMigrations(client) {
  const table = await client.query(
    "SELECT to_regclass('public.schema_migrations') AS table_name",
  );
  if (!table.rows[0]?.table_name) return [];

  const result = await client.query(
    'SELECT version, name, checksum, applied_at FROM schema_migrations ORDER BY version',
  );
  return result.rows;
}

async function ensureMigrationTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version TEXT PRIMARY KEY CHECK (version ~ '^[0-9]{4}$'),
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export async function applyMigrationPlan(client, pending, logger = console) {
  for (const migration of pending) {
    await client.query('BEGIN');
    try {
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name, checksum)
         VALUES ($1, $2, $3)`,
        [migration.version, migration.name, migration.checksum],
      );
      await client.query('COMMIT');
      logger.log(`Applied ${migration.filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Migration ${migration.filename} failed`, {
        cause: error,
      });
    }
  }
}

export async function runMigrations({
  connectionString = process.env.DATABASE_URL,
  statusOnly = false,
  logger = console,
} = {}) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required');
  }

  const migrations = await discoverMigrations();
  const client = new Client({ connectionString });
  await client.connect();

  try {
    if (statusOnly) {
      const applied = await readAppliedMigrations(client);
      const pending = buildMigrationPlan(migrations, applied);
      logger.log(`${applied.length} applied, ${pending.length} pending`);
      for (const migration of pending) logger.log(`Pending ${migration.filename}`);
      return { applied, pending };
    }

    await client.query('SELECT pg_advisory_lock(hashtext($1))', [LOCK_NAME]);
    try {
      await ensureMigrationTable(client);
      const applied = await readAppliedMigrations(client);
      const pending = buildMigrationPlan(migrations, applied);
      await applyMigrationPlan(client, pending, logger);
      logger.log(
        pending.length === 0
          ? 'Database schema is up to date'
          : `Applied ${pending.length} migration(s)`,
      );
      return { applied, pending };
    } finally {
      await client.query('SELECT pg_advisory_unlock(hashtext($1))', [LOCK_NAME]);
    }
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  runMigrations({ statusOnly: process.argv.includes('--status') }).catch(
    (error) => {
      console.error(error.message);
      process.exitCode = 1;
    },
  );
}
