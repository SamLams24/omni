export async function POST() {
  return Response.json(
    { error: "Cette fonctionnalité est temporairement indisponible.", code: "FEATURE_DISABLED" },
    { status: 503, headers: { "Cache-Control": "no-store" } }
  );
}
