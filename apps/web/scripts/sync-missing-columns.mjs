import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

// Preserve the price shown when an availability request is created.
await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,2)`;
await sql`ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes')`;
await sql`
  UPDATE availability_requests ar
  SET unit_price = p.price
  FROM products p
  WHERE ar.product_id = p.id AND ar.unit_price IS NULL
`;
await sql`ALTER TABLE availability_requests DROP CONSTRAINT IF EXISTS availability_requests_status_check`;
await sql`ALTER TABLE availability_requests ADD CONSTRAINT availability_requests_status_check CHECK (status IN ('queued', 'pending', 'confirmed', 'denied'))`;
await sql`ALTER TABLE availability_requests ALTER COLUMN status SET DEFAULT 'queued'`;
console.log('✓ unit_price snapshot added to availability_requests');

// Add missing columns to delivery_requests
await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 500`;
console.log('✓ delivery_fee added to delivery_requests');

await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10,2) DEFAULT 0`;
console.log('✓ distance_km added to delivery_requests');

await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS pickup_location GEOGRAPHY(Point, 4326)`;
console.log('✓ pickup_location added to delivery_requests');

await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS dropoff_location GEOGRAPHY(Point, 4326)`;
console.log('✓ dropoff_location added to delivery_requests');

await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE`;
console.log('✓ vendor_id added to delivery_requests');

// Add refunded_at to escrow_holds (for backwards compatibility)
await sql`ALTER TABLE escrow_holds ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP`;
console.log('✓ refunded_at added to escrow_holds');

// Ensure facility_id is in delivery_requests
await sql`ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE`;
console.log('✓ facility_id ensured in delivery_requests');

// Add UNIQUE constraint for products if missing — first deduplicate
const constraintExists = await sql`SELECT 1 FROM pg_constraint WHERE conname = 'products_vendor_name_key'`;
if (constraintExists.length === 0) {
  // Keep only the first/oldest product for each (vendor_id, name) pair
  await sql`
    DELETE FROM products p1 USING (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY vendor_id, name ORDER BY created_at ASC) as rn
        FROM products
      ) dup WHERE dup.rn > 1
    ) p2 WHERE p1.id = p2.id
  `;
  await sql`ALTER TABLE products ADD CONSTRAINT products_vendor_name_key UNIQUE (vendor_id, name)`;
  console.log('✓ UNIQUE constraint added to products (duplicates removed)');
} else {
  console.log('✓ UNIQUE constraint already exists on products');
}

// Ensure delivery_payment type is in transactions check constraint
await sql`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check`;
await sql`ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN ('deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'fee', 'delivery_payment'))`;
console.log('✓ delivery_payment type added to transactions');

// Add delivery_confirmed_at to escrow_holds
await sql`ALTER TABLE escrow_holds ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP`;
console.log('✓ delivery_confirmed_at added to escrow_holds');

// Keep the escrow state machine aligned with the dispute endpoint.
await sql`ALTER TABLE escrow_holds DROP CONSTRAINT IF EXISTS escrow_holds_status_check`;
await sql`ALTER TABLE escrow_holds ADD CONSTRAINT escrow_holds_status_check CHECK (status IN ('held', 'disputed', 'released', 'refunded'))`;
console.log('✓ disputed status added to escrow_holds');

// Delivery requests wait for the vendor's cart response before matching.
await sql`ALTER TABLE delivery_requests DROP CONSTRAINT IF EXISTS delivery_requests_status_check`;
await sql`ALTER TABLE delivery_requests ADD CONSTRAINT delivery_requests_status_check CHECK (status IN ('awaiting_confirmation', 'looking', 'matched', 'picked_up', 'in_transit', 'delivered', 'cancelled'))`;
await sql`ALTER TABLE delivery_requests ALTER COLUMN status SET DEFAULT 'awaiting_confirmation'`;
console.log('✓ awaiting_confirmation status added to delivery_requests');

process.exit(0);
