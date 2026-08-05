export async function POST(request) {
  try {
    const { token } = await request.json();

    if (!token) {
      console.error('[SetSession] Missing token');
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    console.log('[SetSession] Setting cookie, token length:', token.length, 'token starts:', token.substring(0, 20));
    const response = Response.json({ ok: true });
    response.headers.set(
      'Set-Cookie',
      `omni_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    return response;
  } catch (error) {
    console.error('[SetSession] Error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
