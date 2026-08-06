import { getServerSession } from "@/lib/auth";

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const authHeader = request.headers.get('authorization');
    const hasCookie = cookieHeader && cookieHeader.includes('omni_session=');
    const hasAuthHeader = authHeader && authHeader.startsWith('Bearer ');
    console.log('[Session] GET | cookie:', hasCookie, '| authHeader:', hasAuthHeader);

    const session = await getServerSession(request);
    console.log('[Session] result:', session?.data?.user ? `user=${session.data.user.id}` : 'null');

    if (!session?.data?.user) {
      return Response.json({ user: null, session: null });
    }
    return Response.json({
      user: session.data.user,
      session: session.data.session,
    });
  } catch (error) {
    console.error("[Session] Error:", error);
    return Response.json({ user: null, session: null });
  }
}
