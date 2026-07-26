import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

// Single wallet per user
await sql`
  CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
console.log('✓ wallets table created');

await sql`
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'fee', 'delivery_payment')),
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
console.log('✓ transactions table created');

await sql`
  CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id, created_at)
`;
console.log('✓ transaction indexes created');

await sql`
  CREATE TABLE IF NOT EXISTS escrow_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'held' CHECK (status IN ('held', 'disputed', 'released', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP
  )
`;
console.log('✓ escrow_holds table created');

await sql`
  CREATE INDEX IF NOT EXISTS idx_escrow_cart ON escrow_holds(cart_id)
`;
console.log('✓ escrow indexes created');

// Also add vendor_tier to users
await sql`
  ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_tier TEXT DEFAULT 'free' CHECK (vendor_tier IN ('free', 'premium'))
`;
console.log('✓ vendor_tier column added');

// Create wallets for existing users
await sql`
  INSERT INTO wallets (user_id, balance)
  SELECT id, 0 FROM users
  WHERE id NOT IN (SELECT user_id FROM wallets)
`;
console.log('✓ default wallets created');

process.exit(0);
