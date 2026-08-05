export async function POST(request) {
  try {
    const { token } = await request.json();

    if (typeof token !== 'string' || token.length === 0 || token.length > 8192) {
      return Response.json({ error: 'Missing token' }, { status: 400 });
    }

    const response = Response.json(
      { ok: true },
      { headers: { 'Cache-Control': 'no-store' } },
    );
    response.headers.set(
      'Set-Cookie',
      `omni_session=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
    );
    return response;
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
