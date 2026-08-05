-- Add unique index on transactions.reference to prevent duplicate credits
-- (partial: only non-NULL references can conflict)
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_reference
  ON transactions (reference)
  WHERE reference IS NOT NULL;
