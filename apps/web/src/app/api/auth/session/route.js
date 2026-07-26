import { getServerSession } from '@/lib/auth';

export async function GET(request) {
  const result = await getServerSession(request);
  return Response.json(
    {
      user: result?.data?.user || null,
      session: result?.data?.session || null,
    },
    {
      headers: {
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST() {
  return Response.json(
    { error: 'Sign out through the authentication client' },
    {
      status: 405,
      headers: {
        Allow: 'GET',
        'Cache-Control': 'no-store',
      },
    }
  );
}
