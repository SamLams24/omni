export async function POST() {
  return Response.json(
    {
      error: "Le paiement escrow n’est pas disponible.",
      code: "ESCROW_DISABLED",
    },
    { status: 503, headers: { "Cache-Control": "no-store" } },
  );
}
