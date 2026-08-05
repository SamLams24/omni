export async function POST() {
  try {
    const response = Response.json({ ok: true });
    response.headers.set(
      'Set-Cookie',
      'omni_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'
    );
    return response;
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
