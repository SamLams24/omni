import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  getFedaPayPaymentState,
  isValidFedaPayTransactionId,
  retrieveFedaPayTransaction,
} from "@/lib/fedapay";

export async function GET(request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const transactionId = new URL(request.url).searchParams.get("transactionId");
  if (!isValidFedaPayTransactionId(transactionId)) {
    return Response.json(
      { error: "A valid transactionId is required" },
      { status: 400 },
    );
  }

  const intents = await sql`
    SELECT id
    FROM wallet_deposit_intents
    WHERE user_id = ${user.id}
      AND provider = 'fedapay'
      AND provider_transaction_id = ${transactionId}
      AND status IN ('pending', 'settled')
    LIMIT 1
  `;
  if (!intents[0]?.id) {
    return Response.json({ error: "Deposit intent not found" }, { status: 404 });
  }

  try {
    const transaction = await retrieveFedaPayTransaction(transactionId);
    if (String(transaction?.id || "") !== transactionId) {
      return Response.json({ error: "Transaction identity mismatch" }, { status: 400 });
    }

    return Response.json({
      ok: true,
      paymentState: getFedaPayPaymentState(transaction.status),
    });
  } catch {
    console.error("[FedaPay] Payment status retrieval failed");
    return Response.json(
      { error: "Payment status unavailable" },
      { status: 502 },
    );
  }
}
