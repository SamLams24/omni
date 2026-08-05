import { neon, neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const dbUrl = process.env.DATABASE_URL;
const sql = dbUrl ? neon(dbUrl) : null;

function getAuthUrl() {
  return (process.env.NEON_AUTH_URL || import.meta.env.VITE_NEON_AUTH_URL || '').replace(/\/+$/, '') || null;
}

async function ensureAppUser(authUser) {
  if (!sql) return;

  try {
    const email = authUser.email || `${authUser.id.replace(/-/g, '')}@omni.app`;
    await sql`
      INSERT INTO users (id, name, email)
      VALUES (${authUser.id}::uuid, ${authUser.name || 'Utilisateur'}, ${email})
      ON CONFLICT (id) DO UPDATE
        SET name = COALESCE(EXCLUDED.name, users.name),
            email = COALESCE(EXCLUDED.email, users.email),
            updated_at = CURRENT_TIMESTAMP
    `;
  } catch (error) {
    console.error('[Auth] Failed to sync authenticated user');
  }
}

export async function getServerSession(request) {
  const authUrl = getAuthUrl();
  const cookie = request.headers.get('cookie');

  if (!authUrl || !cookie) {
    return null;
  }

  try {
    const response = await fetch(`${authUrl}/get-session`, {
      headers: {
        accept: 'application/json',
        cookie,
      },
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data?.user?.id) {
      return null;
    }

    await ensureAppUser(data.user);
    return {
      data: {
        user: data.user,
        session: data.session || {},
      },
    };
  } catch {
    return null;
  }
}

export async function getAuthenticatedUser(request) {
  const session = await getServerSession(request);
  return session?.data?.user || null;
}
