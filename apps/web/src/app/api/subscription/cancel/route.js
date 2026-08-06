export async function POST() {
  return Response.json(
    {
      error: "La gestion des abonnements n’est pas encore disponible.",
      code: "SUBSCRIPTIONS_DISABLED",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
