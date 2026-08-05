import { getServerSession } from "@/lib/auth";

export async function GET(request) {
  try {
    const session = await getServerSession(request);
    if (!session?.data?.user) {
      return Response.json({ user: null, session: null });
    }
    return Response.json({
      user: session.data.user,
      session: session.data.session,
    });
  } catch (error) {
    return Response.json({ user: null, session: null });
  }
}
