CREATE TABLE IF NOT EXISTS fedapay_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_event_id TEXT NOT NULL UNIQUE
    CHECK (char_length(provider_event_id) BETWEEN 1 AND 255),
  event_name TEXT NOT NULL,
  provider_transaction_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'processed', 'ignored', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 1 CHECK (attempts > 0),
  last_error_code TEXT,
  first_received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_received_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fedapay_webhook_events_status
  ON fedapay_webhook_events (status, last_received_at);
