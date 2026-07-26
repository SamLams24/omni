-- Migration for existing DBs
-- Adds all missing tables/columns from the current schema
-- Safe to run multiple times (idempotent)

-- 1. Add password_hash to auth_users (for legacy auth helpers)
ALTER TABLE auth_users ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- 2. Create availability_requests table
CREATE TABLE IF NOT EXISTS availability_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_requested DECIMAL(10, 2) NOT NULL,
    quantity_confirmed DECIMAL(10, 2),
    unit_price DECIMAL(10,2),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'pending', 'confirmed', 'denied')),
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_availability_requests_vendor ON availability_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_buyer ON availability_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_status ON availability_requests(status);

-- 3. Create notifications table (if not exists from add-mvp-tables)
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    message TEXT,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read) WHERE is_read = false;
