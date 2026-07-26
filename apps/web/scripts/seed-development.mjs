import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

function assertDevelopmentSeedAllowed(environment = process.env) {
  if (
    environment.NODE_ENV === 'production'
    || environment.ALLOW_DEVELOPMENT_SEED !== 'true'
  ) {
    throw new Error(
      'Development seed disabled. Set ALLOW_DEVELOPMENT_SEED=true outside production.',
    );
  }
  if (!environment.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }
}

export async function seedDevelopment(environment = process.env) {
  assertDevelopmentSeedAllowed(environment);
  const scriptDirectory = dirname(fileURLToPath(import.meta.url));
  const seed = await readFile(
    resolve(scriptDirectory, '../db/seeds/development.sql'),
    'utf8',
  );
  const client = new Client({ connectionString: environment.DATABASE_URL });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query(seed);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
}

const isMain = process.argv[1]
  && resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  seedDevelopment()
    .then(() => console.log('Development data seeded'))
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
}

export { assertDevelopmentSeedAllowed };
