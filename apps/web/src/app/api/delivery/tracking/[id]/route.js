export async function GET() {
  return Response.json(
    {
      error: "Le suivi en temps réel n’est pas encore disponible.",
      code: "DELIVERY_TRACKING_UNAVAILABLE",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
