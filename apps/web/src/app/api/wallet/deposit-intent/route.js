import sql from "@/app/api/utils/sql";
import { getAuthenticatedUser } from "@/lib/auth";
import {
  createFedaPayTransaction,
  FedaPayApiError,
  generateFedaPayCheckout,
  isValidFedaPayTransactionId,
  normalizeTogoPhoneNumber,
  sendFedaPayTogoMobileMoneyPush,
} from "@/lib/fedapay";

const DEFAULT_MIN_DEPOSIT = 100;
const DEFAULT_MAX_DEPOSIT = 1_000_000;

function readPositiveInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function getDepositLimits(env = process.env) {
  const min = readPositiveInteger(
    env.FEDAPAY_MIN_DEPOSIT_AMOUNT,
    DEFAULT_MIN_DEPOSIT,
  );
  const max = readPositiveInteger(
    env.FEDAPAY_MAX_DEPOSIT_AMOUNT,
    DEFAULT_MAX_DEPOSIT,
  );

  return min <= max
    ? { min, max }
    : { min: DEFAULT_MIN_DEPOSIT, max: DEFAULT_MAX_DEPOSIT };
}

export async function POST(request) {
  const user = await getAuthenticatedUser(request);
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const amount = Number(body?.amount);
  const phoneNumber = normalizeTogoPhoneNumber(body?.phoneNumber);
  const { min, max } = getDepositLimits();
  if (
    typeof body?.amount !== "number"
    || !Number.isSafeInteger(amount)
    || amount < min
    || amount > max
  ) {
    return Response.json(
      { error: `Amount must be an integer between ${min} and ${max} XOF` },
      { status: 400 },
    );
  }
  if (!phoneNumber) {
    return Response.json(
      { error: "A valid Togo Mobile Money number is required" },
      { status: 400 },
    );
  }

  const intents = await sql`
    INSERT INTO wallet_deposit_intents (user_id, amount, currency)
    SELECT ${user.id}, ${amount}, 'XOF'
    WHERE (
      SELECT COUNT(*)
      FROM wallet_deposit_intents
      WHERE user_id = ${user.id}
        AND created_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
    ) < 5
    RETURNING id
  `;
  const intentId = intents[0]?.id;
  if (!intentId) {
    return Response.json(
      { error: "Too many payment attempts. Please try again later." },
      { status: 429 },
    );
  }

  try {
    const transaction = await createFedaPayTransaction({
      amount,
      currency: { iso: "XOF" },
      description: `Recharge portefeuille Omni - ${amount} FCFA`,
      callback_url: new URL("/wallet?payment=fedapay", request.url).toString(),
      custom_metadata: {
        omni_deposit_intent_id: intentId,
      },
    });
    const providerTransactionId = String(transaction?.id || "");

    if (!isValidFedaPayTransactionId(providerTransactionId)) {
      throw new FedaPayApiError("FedaPay returned an invalid transaction id");
    }
    if (Number(transaction?.amount) !== amount) {
      throw new FedaPayApiError("FedaPay returned an invalid transaction amount");
    }

    const updated = await sql`
      UPDATE wallet_deposit_intents
      SET provider_transaction_id = ${providerTransactionId},
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${intentId}
        AND user_id = ${user.id}
        AND status = 'pending'
      RETURNING id
    `;

    if (!updated[0]?.id) {
      throw new Error("Deposit intent could not be linked to FedaPay");
    }

    const checkout = await generateFedaPayCheckout(transaction);

    try {
      await sendFedaPayTogoMobileMoneyPush(transaction, {
        token: checkout.token,
        phoneNumber,
      });
    } catch {
      // The hosted checkout uses the same transaction. This is also safe when
      // the push result is uncertain after a provider timeout.
      return Response.json({
        ok: true,
        intentId,
        transactionId: providerTransactionId,
        amount,
        currency: "XOF",
        flow: "hosted_checkout",
        checkoutUrl: checkout.url,
      });
    }

    return Response.json({
      ok: true,
      intentId,
      transactionId: providerTransactionId,
      amount,
      currency: "XOF",
      flow: "mobile_money_push",
      checkoutUrl: checkout.url,
    });
  } catch (error) {
    try {
      await sql`
        UPDATE wallet_deposit_intents
        SET status = 'failed', updated_at = CURRENT_TIMESTAMP
        WHERE id = ${intentId} AND status = 'pending'
      `;
    } catch {
      console.error("[FedaPay] Deposit intent cleanup failed");
    }
    console.error("[FedaPay] Deposit intent creation failed");
    return Response.json(
      { error: error instanceof FedaPayApiError && error.status === 500
        ? "Payment provider not configured"
        : "Payment provider unavailable" },
      { status: error instanceof FedaPayApiError ? error.status : 500 },
    );
  }
}
