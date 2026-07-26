import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);

await sql`
  CREATE TABLE IF NOT EXISTS delivery_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    pickup_lat DECIMAL(10,8),
    pickup_lon DECIMAL(11,8),
    dropoff_lat DECIMAL(10,8),
    dropoff_lon DECIMAL(11,8),
    dropoff_address TEXT,
    status TEXT DEFAULT 'awaiting_confirmation' CHECK (status IN ('awaiting_confirmation', 'looking', 'matched', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
    matched_trip_id UUID REFERENCES delivery_planned_trips(id) ON DELETE SET NULL,
    delivery_profile_id UUID REFERENCES delivery_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`;
console.log('✓ delivery_requests table created');

await sql`
  CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status)
`;
await sql`
  CREATE INDEX IF NOT EXISTS idx_delivery_requests_trip ON delivery_requests(matched_trip_id)
`;
console.log('✓ delivery request indexes created');

process.exit(0);
