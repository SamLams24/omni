export async function POST() {
  return Response.json(
    {
      error: "Les abonnements ne sont pas encore disponibles.",
      code: "SUBSCRIPTIONS_DISABLED",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
