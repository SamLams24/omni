export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    const response = Response.json({ ok: true });
    response.headers.set(
      'Set-Cookie',
      `omni_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    return response;
  } catch (error) {
    console.error('[Session] Set session error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
