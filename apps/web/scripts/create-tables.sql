-- Activer l'extension PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- AUTH TABLES (required by @hono/auth-js)
-- ============================================

CREATE TABLE IF NOT EXISTS auth_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    email TEXT UNIQUE,
    "emailVerified" TIMESTAMP,
    image TEXT,
    password_hash TEXT
);

CREATE TABLE IF NOT EXISTS auth_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId" UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    provider TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    access_token TEXT,
    expires_at BIGINT,
    refresh_token TEXT,
    id_token TEXT,
    scope TEXT,
    session_state TEXT,
    token_type TEXT,
    password TEXT
);

CREATE TABLE IF NOT EXISTS auth_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionToken" TEXT NOT NULL UNIQUE,
    "userId" UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    expires TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS auth_verification_token (
    identifier TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires TIMESTAMP NOT NULL,
    PRIMARY KEY (identifier, token)
);

-- ============================================
-- APP TABLES
-- ============================================

-- Table des utilisateurs (pour l'app)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT UNIQUE,
    lat DECIMAL(10, 8),
    lon DECIMAL(11, 8),
    preferred_language TEXT DEFAULT 'fr',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des vendeurs (avec PostGIS location)
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
    is_online BOOLEAN DEFAULT true,
    is_available BOOLEAN DEFAULT true,
    rating DECIMAL(3, 2),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des facilities (multi-activité par vendeur)
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
    is_online BOOLEAN DEFAULT true,
    rating DECIMAL(3, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des produits (facility_id pour les nouvelles tables; ALTER après pour migration)
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    currency TEXT DEFAULT 'XOF',
    unit TEXT DEFAULT 'pièce',
    is_available BOOLEAN DEFAULT true,
    image_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(vendor_id, name)
);

-- Table des messages
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sender_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
    vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
    request_id UUID REFERENCES availability_requests(id) ON DELETE SET NULL,
    facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL,
    content TEXT NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des demandes de disponibilité
CREATE TABLE IF NOT EXISTS availability_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    quantity_requested DECIMAL(10, 2) NOT NULL,
    quantity_confirmed DECIMAL(10, 2),
    status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'pending', 'confirmed', 'denied')),
    expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '5 minutes'),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP
);

-- Migration: facility_id pour les tables existantes
ALTER TABLE products ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE;
ALTER TABLE availability_requests ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS facility_id UUID REFERENCES facilities(id) ON DELETE SET NULL;

-- Créer une facility par défaut pour chaque vendor existant (safe si déjà fait)
INSERT INTO facilities (vendor_id, name, category, type, description, location, address, neighborhood, is_online, rating)
SELECT id, name, category, 'fixed', description, location, address, neighborhood, is_online, rating
FROM vendors v
WHERE NOT EXISTS (SELECT 1 FROM facilities f WHERE f.vendor_id = v.id);

-- Remplir facility_id pour les enregistrements existants qui n'en ont pas
UPDATE products SET facility_id = (SELECT id FROM facilities WHERE vendor_id = products.vendor_id LIMIT 1) WHERE facility_id IS NULL;
UPDATE availability_requests SET facility_id = (SELECT id FROM facilities WHERE vendor_id = availability_requests.vendor_id LIMIT 1) WHERE facility_id IS NULL;

-- Table des favoris
CREATE TABLE IF NOT EXISTS favorites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, vendor_id)
);

-- Table des notifications
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

-- Table des avis
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    facility_id UUID NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(facility_id, user_id)
);

-- Table des profils livreurs
CREATE TABLE IF NOT EXISTS delivery_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    phone TEXT NOT NULL,
    id_type TEXT CHECK (id_type IN ('national_id', 'passport', 'driver_license')),
    id_number TEXT,
    id_verified BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des véhicules de livraison
CREATE TABLE IF NOT EXISTS delivery_vehicles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_profile_id UUID NOT NULL REFERENCES delivery_profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('pedestrian', 'bicycle', 'motorcycle', 'car', 'truck')),
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table des trajets planifiés (multi-stops)
CREATE TABLE IF NOT EXISTS delivery_planned_trips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delivery_profile_id UUID NOT NULL REFERENCES delivery_profiles(id) ON DELETE CASCADE,
    origin_lat DECIMAL(10,8) NOT NULL,
    origin_lon DECIMAL(11,8) NOT NULL,
    destination_lat DECIMAL(10,8) NOT NULL,
    destination_lon DECIMAL(11,8) NOT NULL,
    waypoints JSONB DEFAULT '[]',
    deviation_km DECIMAL(5,2) DEFAULT 2.0,
    departure_time TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Créer index géospatial pour les vendeurs et facilities
CREATE INDEX IF NOT EXISTS idx_vendors_location ON vendors USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_facilities_location ON facilities USING GIST (location);

-- Index pour les recherches rapides
CREATE INDEX IF NOT EXISTS idx_vendors_category ON vendors(category);
CREATE INDEX IF NOT EXISTS idx_vendors_online ON vendors(is_online);
CREATE INDEX IF NOT EXISTS idx_facilities_vendor ON facilities(vendor_id);
CREATE INDEX IF NOT EXISTS idx_facilities_online ON facilities(is_online);
CREATE INDEX IF NOT EXISTS idx_facilities_category ON facilities(category);
CREATE INDEX IF NOT EXISTS idx_products_vendor ON products(vendor_id);
CREATE INDEX IF NOT EXISTS idx_messages_users ON messages(sender_id, receiver_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_vendor ON availability_requests(vendor_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_buyer ON availability_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_availability_requests_status ON availability_requests(status);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_accounts_user ON auth_accounts("userId");
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions("userId");
CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions("sessionToken");
CREATE INDEX IF NOT EXISTS idx_delivery_trips_active ON delivery_planned_trips(delivery_profile_id, is_active);

-- Table des demandes de livraison
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
    status TEXT DEFAULT 'looking' CHECK (status IN ('looking', 'matched', 'picked_up', 'in_transit', 'delivered', 'cancelled')),
    matched_trip_id UUID REFERENCES delivery_planned_trips(id) ON DELETE SET NULL,
    delivery_profile_id UUID REFERENCES delivery_profiles(id) ON DELETE SET NULL,
    delivery_fee DECIMAL(10,2) DEFAULT 500,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table wallets
CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    balance DECIMAL(12,2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table transactions
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'fee', 'delivery_payment')),
    amount DECIMAL(12,2) NOT NULL,
    reference TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table escrow
CREATE TABLE IF NOT EXISTS escrow_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cart_id UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
    buyer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    amount DECIMAL(12,2) NOT NULL,
    fee DECIMAL(12,2) NOT NULL DEFAULT 0,
    status TEXT DEFAULT 'held' CHECK (status IN ('held', 'disputed', 'released', 'refunded')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    released_at TIMESTAMP,
    delivery_confirmed_at TIMESTAMP
);

-- Table abonnements
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('vendor', 'delivery')),
    tier TEXT NOT NULL CHECK (tier IN ('free', 'premium')),
    start_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    end_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Table de proximité
CREATE TABLE IF NOT EXISTS proximity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nearby_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    distance_meters DECIMAL(10,2),
    lat DECIMAL(10,8),
    lon DECIMAL(11,8),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index supplémentaires
CREATE INDEX IF NOT EXISTS idx_delivery_requests_status ON delivery_requests(status);
CREATE INDEX IF NOT EXISTS idx_delivery_requests_trip ON delivery_requests(matched_trip_id);
CREATE INDEX IF NOT EXISTS idx_transactions_wallet ON transactions(wallet_id, created_at);
CREATE INDEX IF NOT EXISTS idx_escrow_cart ON escrow_holds(cart_id);
CREATE INDEX IF NOT EXISTS idx_proximity_user ON proximity_log(user_id, created_at);

-- Colonnes tiers
ALTER TABLE users ADD COLUMN IF NOT EXISTS delivery_tier TEXT DEFAULT 'free' CHECK (delivery_tier IN ('free', 'premium'));
ALTER TABLE users ADD COLUMN IF NOT EXISTS vendor_tier TEXT DEFAULT 'free' CHECK (vendor_tier IN ('free', 'premium'));

-- Colonnes delivery payment
ALTER TABLE delivery_requests ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10,2) DEFAULT 500;
ALTER TABLE escrow_holds ADD COLUMN IF NOT EXISTS delivery_confirmed_at TIMESTAMP;

-- Contrainte unicité produits
ALTER TABLE products ADD CONSTRAINT IF NOT EXISTS products_vendor_name_key UNIQUE (vendor_id, name);

-- Transaction type delivery_payment (on supprime et recrée la contrainte)
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check
  CHECK (type IN ('deposit', 'withdrawal', 'escrow_hold', 'escrow_release', 'escrow_refund', 'fee', 'delivery_payment'));

-- Créer wallets pour utilisateurs existants
INSERT INTO wallets (user_id, balance)
SELECT id, 0 FROM users
WHERE id NOT IN (SELECT user_id FROM wallets)
ON CONFLICT DO NOTHING;

-- Insérer des données de test
INSERT INTO users (name, email, phone, lat, lon, preferred_language, delivery_tier, vendor_tier) VALUES
('Kofi Vendor', 'kofi@vendor.omni', '+22812345678', 6.1319, 1.2228, 'fr'),
('Ama Market', 'ama@vendor.omni', '+22887654321', 6.1325, 1.2235, 'fr'),
('Mariam Shop', 'mariam@vendor.omni', '+22898765432', 6.1305, 1.2215, 'fr')
ON CONFLICT (phone) DO NOTHING;

INSERT INTO vendors (name, category, description, phone, location, address, neighborhood, user_id) VALUES
('Kofi Electronics', 'Électronique', 'Téléphones et accessoires', '+22812345678', ST_SetSRID(ST_Point(1.2228, 6.1319), 4326)::geography, 'Marché de Bè', 'Bè', (SELECT id FROM users WHERE phone = '+22812345678')),
('Ama Market Stand', 'Alimentation', 'Produits locaux et frais', '+22887654321', ST_SetSRID(ST_Point(1.2235, 6.1325), 4326)::geography, 'Marché de Lomé', 'Lomé', (SELECT id FROM users WHERE phone = '+22887654321')),
('Mariam Boutique', 'Vêtements', 'Pagnes et vêtements traditionnels', '+22898765432', ST_SetSRID(ST_Point(1.2215, 6.1305), 4326)::geography, 'Tokoin', 'Tokoin', (SELECT id FROM users WHERE phone = '+22898765432'))
ON CONFLICT (phone) DO NOTHING;

-- Créer une facility par défaut pour chaque vendor
INSERT INTO facilities (vendor_id, name, category, type, description, location, address, neighborhood, is_online)
SELECT v.id, v.name, v.category, 'fixed', v.description, v.location, v.address, v.neighborhood, v.is_online
FROM vendors v
WHERE NOT EXISTS (SELECT 1 FROM facilities f WHERE f.vendor_id = v.id);

INSERT INTO products (vendor_id, facility_id, name, description, price, currency, unit, is_available) VALUES
((SELECT id FROM vendors WHERE phone = '+22812345678'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22812345678') LIMIT 1), 'iPhone 12', 'iPhone 12 64GB excellent état', 150000, 'XOF', 'pièce', true),
((SELECT id FROM vendors WHERE phone = '+22812345678'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22812345678') LIMIT 1), 'Chargeur USB-C', 'Chargeur rapide 20W', 5000, 'XOF', 'pièce', true),
((SELECT id FROM vendors WHERE phone = '+22887654321'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22887654321') LIMIT 1), 'Tomates fraîches', 'Tomates locales du jour', 500, 'XOF', 'kg', true),
((SELECT id FROM vendors WHERE phone = '+22887654321'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22887654321') LIMIT 1), 'Pain local', 'Pain frais du matin', 250, 'XOF', 'pièce', true),
((SELECT id FROM vendors WHERE phone = '+22898765432'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22898765432') LIMIT 1), 'Pagne wax', 'Pagne wax qualité premium', 8000, 'XOF', 'pièce', true),
((SELECT id FROM vendors WHERE phone = '+22898765432'), (SELECT id FROM facilities WHERE vendor_id = (SELECT id FROM vendors WHERE phone = '+22898765432') LIMIT 1), 'Boubou traditionnel', 'Boubou en bazin', 15000, 'XOF', 'pièce', true)
ON CONFLICT DO NOTHING;
