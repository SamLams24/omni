# FedaPay wallet deposits

Omni creates FedaPay transactions on the server and settles wallet deposits
only after retrieving an `approved` transaction from FedaPay's API. The browser
callback and the webhook use the same idempotent settlement service.

For a Togo Mobile Money deposit, Omni generates the hosted checkout URL and
then attempts FedaPay's direct `moov_tg` push first. While the transaction is
pending, the browser checks its status through an authenticated Omni endpoint.
If the push request errors, FedaPay reports a terminal failure, or no result is
available within 45 seconds, the browser opens the hosted FedaPay page. Both
paths reuse the same provider transaction and therefore cannot create two
independent charges for one click.

The server integration uses the official `fedapay` Node.js SDK. Because SDK
version `1.2.5` declares an obsolete Axios range, pnpm forces its transitive
dependency to the audited project version through the `fedapay>axios` override
in `pnpm-workspace.yaml`. Keep the direct Axios version and this override in
sync when upgrading either dependency.

## Required configuration

Configure these variables in each deployment environment:

- `FEDAPAY_SECRET_KEY`: server API key;
- `FEDAPAY_ENVIRONMENT`: exactly `sandbox` or `live`;
- `FEDAPAY_WEBHOOK_SECRET`: secret of the webhook endpoint in the matching
  FedaPay environment;
- `FEDAPAY_MIN_DEPOSIT_AMOUNT` and `FEDAPAY_MAX_DEPOSIT_AMOUNT`: optional XOF
  limits enforced by the server.

Test and live webhook secrets are different. Never expose either server secret
through a `VITE_` variable or commit them to the repository.

FedaPay currently documents direct, redirect-free collection in Togo for Moov
Money (`moov_tg`). The hosted fallback remains necessary for unsupported
operators and must stay enabled even when the direct push works in sandbox.

## Database deployment

Apply migrations before deploying code that depends on them:

```bash
cd apps/web
pnpm db:migrate:status
pnpm db:migrate
```

The deposit flow requires:

- `0004_wallet_deposit_intents.sql`;
- `0005_fedapay_webhook_events.sql`.

## FedaPay dashboard setup

Create one webhook per environment in the FedaPay Workbench:

```text
https://<omni-domain>/api/webhooks/fedapay
```

Use HTTPS and subscribe only to `transaction.approved`. Copy that exact
endpoint's secret to `FEDAPAY_WEBHOOK_SECRET`. A secret belonging to another
URL or environment will make every request fail signature verification.

The endpoint:

1. reads the untouched request body;
2. verifies `X-FEDAPAY-SIGNATURE` with HMAC-SHA256;
3. rejects timestamps outside a five-minute window;
4. persists the event identifier to detect replays;
5. retrieves the transaction from FedaPay instead of trusting webhook fields;
6. records the ledger transaction before crediting the wallet.

Processing currently happens synchronously because Omni does not yet operate a
durable background-job worker. The persisted event state and FedaPay retries
provide recovery from transient failures; moving the same settlement service to
a queue can be done later without changing the payment invariants.

FedaPay retries non-2xx deliveries. Omni returns `503` for temporary provider or
database failures so the event can be retried, and returns `200` for duplicate
or irrelevant authenticated events.

## Verification checklist

In sandbox:

1. create a deposit from an authenticated Omni account;
2. confirm that a Moov Money push is attempted before any redirect;
3. complete the sandbox push and confirm that no hosted page opens;
4. simulate a rejected/unavailable push and confirm that the hosted FedaPay
   page opens for the same transaction identifier;
5. confirm one `wallet_deposit_intents` row becomes `settled`;
6. confirm exactly one `transactions` row uses the corresponding
   `fedapay:<transaction-id>` reference;
7. redeliver the event from the FedaPay dashboard;
8. confirm the wallet balance does not change on redelivery;
9. inspect `fedapay_webhook_events` and verify that `attempts` increased while
   the event remained `processed`.

Do not log request bodies, signatures, API keys, endpoint secrets, or provider
error bodies.

## Current boundary

This integration handles successful wallet deposits. Refund, dispute and
chargeback accounting require a separate reviewed ledger policy before their
webhook events can mutate balances.
