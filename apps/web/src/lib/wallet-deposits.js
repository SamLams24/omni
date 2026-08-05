import sql from "@/app/api/utils/sql";
import {
  isValidFedaPayTransactionId,
  retrieveFedaPayTransaction,
} from "@/lib/fedapay";

function failure(code, status, message) {
  return { ok: false, code, status, error: message };
}

async function findIntent(transactionId, userId) {
  if (userId) {
    const intents = await sql`
      SELECT id, user_id, amount, currency, status
      FROM wallet_deposit_intents
      WHERE user_id = ${userId}
        AND provider = 'fedapay'
        AND provider_transaction_id = ${transactionId}
      LIMIT 1
    `;
    return intents[0] || null;
  }

  const intents = await sql`
    SELECT id, user_id, amount, currency, status
    FROM wallet_deposit_intents
    WHERE provider = 'fedapay'
      AND provider_transaction_id = ${transactionId}
    LIMIT 1
  `;
  return intents[0] || null;
}

async function currentBalance(userId) {
  const wallets = await sql`SELECT balance FROM wallets WHERE user_id = ${userId}`;
  return wallets.length > 0 ? Number(wallets[0].balance) : 0;
}

export async function settleFedaPayDeposit({ transactionId, userId = null }) {
  if (!isValidFedaPayTransactionId(transactionId)) {
    return failure("invalid_transaction_id", 400, "A valid transactionId is required");
  }

  const intent = await findIntent(transactionId, userId);
  if (!intent) {
    return failure("intent_not_found", 404, "Deposit intent not found");
  }

  if (intent.status === "settled") {
    return {
      ok: true,
      alreadyProcessed: true,
      balance: await currentBalance(intent.user_id),
      amount: Number(intent.amount),
      currency: intent.currency,
      transactionId,
    };
  }
  if (intent.status !== "pending") {
    return failure("intent_not_payable", 409, "Deposit intent is not payable");
  }

  const transaction = await retrieveFedaPayTransaction(transactionId);
  if (String(transaction?.id || "") !== transactionId) {
    return failure("identity_mismatch", 400, "Transaction identity mismatch");
  }
  if (transaction.status !== "approved") {
    return failure("not_approved", 409, "Transaction is not approved");
  }

  const confirmedAmount = Number(transaction.amount);
  const expectedAmount = Number(intent.amount);
  if (!Number.isSafeInteger(confirmedAmount) || confirmedAmount !== expectedAmount) {
    return failure("amount_mismatch", 400, "Transaction amount mismatch");
  }
  if (transaction.custom_metadata?.omni_deposit_intent_id !== intent.id) {
    return failure("ownership_mismatch", 403, "Transaction ownership mismatch");
  }

  await sql`
    INSERT INTO wallets (user_id, balance)
    VALUES (${intent.user_id}, 0)
    ON CONFLICT (user_id) DO NOTHING
  `;

  const reference = `fedapay:${transactionId}`;
  const credited = await sql`
    WITH claimed_intent AS (
      UPDATE wallet_deposit_intents
      SET status = 'settled',
          settled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${intent.id}
        AND user_id = ${intent.user_id}
        AND provider_transaction_id = ${transactionId}
        AND status = 'pending'
        AND amount = ${confirmedAmount}
      RETURNING amount
    ),
    recorded_tx AS (
      INSERT INTO transactions (wallet_id, type, amount, reference)
      SELECT wallets.id, 'deposit', claimed_intent.amount, ${reference}
      FROM wallets, claimed_intent
      WHERE wallets.user_id = ${intent.user_id}
      ON CONFLICT (reference) WHERE reference IS NOT NULL DO NOTHING
      RETURNING wallet_id
    ),
    credited_wallet AS (
      UPDATE wallets
      SET balance = wallets.balance + claimed_intent.amount,
          updated_at = CURRENT_TIMESTAMP
      FROM claimed_intent, recorded_tx
      WHERE wallets.id = recorded_tx.wallet_id
      RETURNING wallets.balance
    )
    SELECT
      (SELECT balance FROM credited_wallet) AS balance,
      EXISTS (SELECT 1 FROM claimed_intent) AS claimed,
      EXISTS (SELECT 1 FROM recorded_tx) AS recorded
  `;

  if (!credited[0]?.recorded) {
    return {
      ok: true,
      alreadyProcessed: true,
      balance: await currentBalance(intent.user_id),
      amount: confirmedAmount,
      currency: "XOF",
      transactionId,
    };
  }

  return {
    ok: true,
    alreadyProcessed: false,
    balance: Number(credited[0].balance),
    amount: confirmedAmount,
    currency: "XOF",
    transactionId,
  };
}
