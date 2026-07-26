INSERT INTO users (
  name, email, phone, lat, lon, preferred_language
) VALUES
  ('Kofi Vendor', 'kofi@vendor.omni', '+22812345678', 6.1319, 1.2228, 'fr'),
  ('Ama Market', 'ama@vendor.omni', '+22887654321', 6.1325, 1.2235, 'fr'),
  ('Mariam Shop', 'mariam@vendor.omni', '+22898765432', 6.1305, 1.2215, 'fr')
ON CONFLICT (email) DO NOTHING;

INSERT INTO vendors (
  name, category, description, phone, location, address, neighborhood, user_id
)
SELECT
  'Kofi Electronics', 'Électronique', 'Téléphones et accessoires',
  '+22812345678',
  ST_SetSRID(ST_Point(1.2228, 6.1319), 4326)::geography,
  'Marché de Bè', 'Bè',
  (SELECT id FROM users WHERE email = 'kofi@vendor.omni')
WHERE NOT EXISTS (
  SELECT 1 FROM vendors WHERE phone = '+22812345678'
);

INSERT INTO vendors (
  name, category, description, phone, location, address, neighborhood, user_id
)
SELECT
  'Ama Market Stand', 'Alimentation', 'Produits locaux et frais',
  '+22887654321',
  ST_SetSRID(ST_Point(1.2235, 6.1325), 4326)::geography,
  'Marché de Lomé', 'Lomé',
  (SELECT id FROM users WHERE email = 'ama@vendor.omni')
WHERE NOT EXISTS (
  SELECT 1 FROM vendors WHERE phone = '+22887654321'
);

INSERT INTO vendors (
  name, category, description, phone, location, address, neighborhood, user_id
)
SELECT
  'Mariam Boutique', 'Vêtements', 'Pagnes et vêtements traditionnels',
  '+22898765432',
  ST_SetSRID(ST_Point(1.2215, 6.1305), 4326)::geography,
  'Tokoin', 'Tokoin',
  (SELECT id FROM users WHERE email = 'mariam@vendor.omni')
WHERE NOT EXISTS (
  SELECT 1 FROM vendors WHERE phone = '+22898765432'
);

INSERT INTO facilities (
  vendor_id, name, category, type, description, location,
  address, neighborhood, is_online
)
SELECT
  id, name, category, 'fixed', description, location,
  address, neighborhood, is_online
FROM vendors AS vendor
WHERE vendor.phone IN ('+22812345678', '+22887654321', '+22898765432')
  AND NOT EXISTS (
    SELECT 1 FROM facilities WHERE facilities.vendor_id = vendor.id
  );

INSERT INTO products (
  vendor_id, facility_id, name, description, price, currency, unit, is_available
) VALUES
  (
    (SELECT id FROM vendors WHERE phone = '+22812345678' LIMIT 1),
    (SELECT facilities.id FROM facilities JOIN vendors ON vendors.id = facilities.vendor_id
      WHERE vendors.phone = '+22812345678' LIMIT 1),
    'iPhone 12', 'iPhone 12 64GB excellent état',
    150000, 'XOF', 'pièce', true
  ),
  (
    (SELECT id FROM vendors WHERE phone = '+22887654321' LIMIT 1),
    (SELECT facilities.id FROM facilities JOIN vendors ON vendors.id = facilities.vendor_id
      WHERE vendors.phone = '+22887654321' LIMIT 1),
    'Tomates fraîches', 'Tomates locales du jour',
    500, 'XOF', 'kg', true
  ),
  (
    (SELECT id FROM vendors WHERE phone = '+22898765432' LIMIT 1),
    (SELECT facilities.id FROM facilities JOIN vendors ON vendors.id = facilities.vendor_id
      WHERE vendors.phone = '+22898765432' LIMIT 1),
    'Pagne wax', 'Pagne wax qualité premium',
    8000, 'XOF', 'pièce', true
  )
ON CONFLICT (vendor_id, name) DO NOTHING;
