import { getServerSession } from "@/lib/auth";

export async function GET(request) {
  try {
    const cookieHeader = request.headers.get('cookie');
    const hasCookie = cookieHeader && cookieHeader.includes('omni_session=');
    console.log('[Session] GET received | hasCookie:', hasCookie, '| cookiePreview:', cookieHeader ? cookieHeader.substring(0, 80) : 'none');

    const session = await getServerSession(request);
    console.log('[Session] getServerSession result:', session?.data?.user ? `user=${session.data.user.id}` : 'null');

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
