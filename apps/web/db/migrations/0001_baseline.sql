CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT UNIQUE,
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  preferred_language TEXT NOT NULL DEFAULT 'fr',
  avatar_url TEXT,
  bio TEXT,
  delivery_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (delivery_tier IN ('free', 'premium')),
  vendor_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (vendor_tier IN ('free', 'premium')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address TEXT,
  neighborhood TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  is_available BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(3, 2),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'fixed' CHECK (type IN ('fixed', 'mobile')),
  description TEXT,
  location GEOGRAPHY(Point, 4326) NOT NULL,
  address TEXT,
  neighborhood TEXT,
  is_online BOOLEAN NOT NULL DEFAULT true,
  rating DECIMAL(3, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
  currency TEXT NOT NULL DEFAULT 'XOF',
  unit TEXT NOT NULL DEFAULT 'pièce',
  is_available BOOLEAN NOT NULL DEFAULT true,
  image_url TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT products_vendor_name_key UNIQUE (vendor_id, name)
);

CREATE TABLE IF NOT EXISTS carts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  note TEXT,
  payment_method TEXT NOT NULL DEFAULT 'cash'
    CHECK (payment_method IN ('cash', 'escrow')),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'confirmed', 'partial', 'denied', 'completed', 'cancelled'
    )),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
  responded_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS availability_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  cart_id UUID REFERENCES carts(id) ON DELETE SET NULL,
  quantity_requested DECIMAL(10, 2) NOT NULL CHECK (quantity_requested > 0),
  quantity_confirmed DECIMAL(10, 2),
  unit_price DECIMAL(10, 2),
  status TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'pending', 'confirmed', 'denied')),
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  request_id UUID REFERENCES availability_requests(id) ON DELETE SET NULL,
  facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorites (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (facility_id, user_id)
);

CREATE TABLE IF NOT EXISTS delivery_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  id_type TEXT CHECK (
    id_type IN ('national_id', 'passport', 'driver_license')
  ),
  id_number TEXT,
  id_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  current_lat DECIMAL(10, 8),
  current_lon DECIMAL(11, 8),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_vehicles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_profile_id UUID NOT NULL
    REFERENCES delivery_profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (
    type IN ('pedestrian', 'bicycle', 'motorcycle', 'car', 'truck')
  ),
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (delivery_profile_id, type)
);

CREATE TABLE IF NOT EXISTS delivery_planned_trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_profile_id UUID NOT NULL
    REFERENCES delivery_profiles(id) ON DELETE CASCADE,
  origin_lat DECIMAL(10, 8) NOT NULL,
  origin_lon DECIMAL(11, 8) NOT NULL,
  destination_lat DECIMAL(10, 8) NOT NULL,
  destination_lon DECIMAL(11, 8) NOT NULL,
  waypoints JSONB NOT NULL DEFAULT '[]'::jsonb,
  deviation_km DECIMAL(5, 2) NOT NULL DEFAULT 2.0,
  departure_time TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS delivery_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  pickup_lat DECIMAL(10, 8),
  pickup_lon DECIMAL(11, 8),
  dropoff_lat DECIMAL(10, 8),
  dropoff_lon DECIMAL(11, 8),
  pickup_location GEOGRAPHY(Point, 4326),
  dropoff_location GEOGRAPHY(Point, 4326),
  dropoff_address TEXT,
  distance_km DECIMAL(10, 2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'awaiting_confirmation'
    CHECK (status IN (
      'awaiting_confirmation', 'looking', 'matched', 'picked_up',
      'in_transit', 'delivered', 'cancelled'
    )),
  matched_trip_id UUID REFERENCES delivery_planned_trips(id)
    ON DELETE SET NULL,
  delivery_profile_id UUID REFERENCES delivery_profiles(id)
    ON DELETE SET NULL,
  delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 500,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  balance DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN (
    'deposit', 'withdrawal', 'escrow_hold', 'escrow_release',
    'escrow_refund', 'fee', 'delivery_payment'
  )),
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  reference TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS escrow_holds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL CHECK (amount >= 0),
  fee DECIMAL(12, 2) NOT NULL DEFAULT 0 CHECK (fee >= 0),
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'disputed', 'released', 'refunded')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  released_at TIMESTAMP,
  refunded_at TIMESTAMP,
  delivery_confirmed_at TIMESTAMP,
  UNIQUE (cart_id)
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('vendor', 'delivery')),
  tier TEXT NOT NULL CHECK (tier IN ('free', 'premium')),
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS proximity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nearby_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  distance_meters DECIMAL(10, 2),
  lat DECIMAL(10, 8),
  lon DECIMAL(11, 8),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_vendors_location
  ON vendors USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors (category);
CREATE INDEX IF NOT EXISTS idx_vendors_online ON vendors (is_online);
CREATE INDEX IF NOT EXISTS idx_facilities_location
  ON facilities USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_facilities_vendor ON facilities (vendor_id);
CREATE INDEX IF NOT EXISTS idx_facilities_online ON facilities (is_online);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON facilities (category);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products (vendor_id);
CREATE INDEX IF NOT EXISTS idx_carts_buyer ON carts (buyer_id);
CREATE INDEX IF NOT EXISTS idx_carts_facility ON carts (facility_id);
CREATE INDEX IF NOT EXISTS idx_carts_status ON carts (status);
CREATE INDEX IF NOT EXISTS idx_availability_requests_vendor
  ON availability_requests (vendor_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_buyer
  ON availability_requests (buyer_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_status
  ON availability_requests (status);
CREATE INDEX IF NOT EXISTS idx_messages_users
  ON messages (sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_request ON messages (request_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user
  ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_reviews_facility ON reviews (facility_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews (user_id);
CREATE INDEX IF NOT EXISTS idx_delivery_trips_active
  ON delivery_planned_trips (delivery_profile_id, is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status
  ON delivery_requests (status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_trip
  ON delivery_requests (matched_trip_id);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_profile
  ON delivery_requests (delivery_profile_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet
  ON transactions (wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_cart ON escrow_holds (cart_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user
  ON subscriptions (user_id, type, end_date);
CREATE INDEX IF NOT EXISTS idx_proximity_user
  ON proximity_log (user_id, created_at);

ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_tier TEXT DEFAULT 'free';
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_tier TEXT DEFAULT 'free';
ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS facility_id UUID
  REFERENCES facilities(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_products_facility ON products (facility_id);
ALTER TABLE carts
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE availability_requests
  ADD COLUMN IF NOT EXISTS facility_id UUID
  REFERENCES facilities(id) ON DELETE CASCADE;
ALTER TABLE availability_requests
  ADD COLUMN IF NOT EXISTS cart_id UUID
  REFERENCES carts(id) ON DELETE SET NULL;
ALTER TABLE availability_requests
  ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);
ALTER TABLE availability_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP
  DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes');
CREATE INDEX IF NOT EXISTS idx_availability_requests_cart
  ON availability_requests (cart_id);
ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS facility_id UUID
  REFERENCES facilities(id) ON DELETE SET NULL;

ALTER TABLE delivery_profiles
  ADD COLUMN IF NOT EXISTS current_lat DECIMAL(10, 8);
ALTER TABLE delivery_profiles
  ADD COLUMN IF NOT EXISTS current_lon DECIMAL(11, 8);
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS vendor_id UUID
  REFERENCES vendors(id) ON DELETE CASCADE;
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 500;
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS distance_km DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS pickup_location GEOGRAPHY(Point, 4326);
ALTER TABLE delivery_requests
  ADD COLUMN IF NOT EXISTS dropoff_location GEOGRAPHY(Point, 4326);
ALTER TABLE escrow_holds
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMP;
ALTER TABLE escrow_holds
  ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP;

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_sender_id_fkey;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_receiver_id_fkey;
ALTER TABLE messages
  ADD CONSTRAINT messages_sender_id_fkey
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;
ALTER TABLE messages
  ADD CONSTRAINT messages_receiver_id_fkey
  FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE NOT VALID;

INSERT INTO facilities (
  vendor_id, name, category, type, description, location,
  address, neighborhood, is_online, rating
)
SELECT
  vendor.id, vendor.name, vendor.category, 'fixed', vendor.description,
  vendor.location, vendor.address, vendor.neighborhood,
  vendor.is_online, vendor.rating
FROM vendors AS vendor
WHERE NOT EXISTS (
  SELECT 1 FROM facilities WHERE facilities.vendor_id = vendor.id
);

UPDATE products
SET facility_id = (
  SELECT id FROM facilities
  WHERE facilities.vendor_id = products.vendor_id
  ORDER BY created_at, id
  LIMIT 1
)
WHERE facility_id IS NULL;

UPDATE availability_requests
SET facility_id = (
  SELECT id FROM facilities
  WHERE facilities.vendor_id = availability_requests.vendor_id
  ORDER BY created_at, id
  LIMIT 1
)
WHERE facility_id IS NULL;

UPDATE availability_requests AS request
SET unit_price = product.price
FROM products AS product
WHERE request.product_id = product.id AND request.unit_price IS NULL;

INSERT INTO wallets (user_id, balance)
SELECT id, 0 FROM users
ON CONFLICT (user_id) DO NOTHING;
