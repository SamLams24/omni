import { getServerSession } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await getServerSession(request);

    if (!session?.data?.user) {
      return Response.json(
        { user: null, session: null },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }
    return Response.json({
      user: session.data.user,
      session: session.data.session,
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json(
      { user: null, session: null },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export function POST() {
  return Response.json(
    { error: 'Method Not Allowed' },
    {
      status: 405,
      headers: {
        Allow: 'GET',
        'Cache-Control': 'no-store',
      },
    },
  );
}
