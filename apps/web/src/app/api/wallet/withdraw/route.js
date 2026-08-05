export async function POST() {
  return Response.json(
    {
      error: "Les retraits ne sont pas encore disponibles.",
      code: "WITHDRAWALS_DISABLED",
    },
    {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
