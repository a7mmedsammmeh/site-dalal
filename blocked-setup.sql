-- ═══════════════════════════════════════════════════════
-- DALAL — Blocked Phones & Device Fingerprints
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Blocked Phone Numbers
CREATE TABLE IF NOT EXISTS blocked_phones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blocked_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on blocked_phones"
ON blocked_phones FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on blocked_phones"
ON blocked_phones FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public delete on blocked_phones"
ON blocked_phones FOR DELETE TO public USING (true);

-- 2. Blocked Device Fingerprints
CREATE TABLE IF NOT EXISTS blocked_fingerprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_ip_ref TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blocked_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on blocked_fingerprints"
ON blocked_fingerprints FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on blocked_fingerprints"
ON blocked_fingerprints FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public delete on blocked_fingerprints"
ON blocked_fingerprints FOR DELETE TO public USING (true);

-- Add blocked_ip_ref column if it doesn't exist
ALTER TABLE blocked_fingerprints ADD COLUMN IF NOT EXISTS blocked_ip_ref TEXT;

-- 3. Add client_ip column to reviews table
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS client_ip TEXT;

-- 4. Add fingerprint column to visitors table
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS fingerprint TEXT;

-- ═══════════════════════════════════════════════════════
-- DALAL — Product Stock Management
-- ═══════════════════════════════════════════════════════

-- 5. Product Stock Status
CREATE TABLE IF NOT EXISTS product_stock (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id INTEGER NOT NULL UNIQUE,
    in_stock BOOLEAN DEFAULT true,
    visibility_status TEXT DEFAULT 'visible' CHECK (visibility_status IN ('visible', 'out_of_stock', 'hidden')),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE product_stock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on product_stock"
ON product_stock FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on product_stock"
ON product_stock FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on product_stock"
ON product_stock FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public delete on product_stock"
ON product_stock FOR DELETE TO public USING (true);

-- ═══════════════════════════════════════════════════════
-- DALAL — Activity Logs
-- ═══════════════════════════════════════════════════════

-- 6. Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    action_type TEXT NOT NULL,
    action_description TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on activity_logs"
ON activity_logs FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on activity_logs"
ON activity_logs FOR INSERT TO public WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action_type ON activity_logs(action_type);
CREATE INDEX IF NOT EXISTS idx_activity_logs_entity_type ON activity_logs(entity_type);

-- ═══════════════════════════════════════════════════════
-- DALAL — Products Management
-- ═══════════════════════════════════════════════════════

-- 7. Products Table
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    code TEXT NOT NULL,
    name_ar TEXT NOT NULL,
    name_en TEXT NOT NULL,
    description_ar TEXT,
    description_en TEXT,
    main_image_url TEXT,
    featured BOOLEAN DEFAULT false,
    sizes TEXT[], -- Array of sizes: ['L', 'XL', '2XL', '3XL', '4XL', '5XL', '6XL', '7XL', '8XL'] or custom
    display_order INTEGER DEFAULT 0, -- For sorting products
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on products"
ON products FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on products"
ON products FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on products"
ON products FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public delete on products"
ON products FOR DELETE TO public USING (true);

-- 8. Product Gallery Images
CREATE TABLE IF NOT EXISTS product_images (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    image_order INTEGER NOT NULL, -- For sorting images (user can reorder)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE product_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on product_images"
ON product_images FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on product_images"
ON product_images FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on product_images"
ON product_images FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public delete on product_images"
ON product_images FOR DELETE TO public USING (true);

-- 9. Product Pricing (4 offers per product, per language)
CREATE TABLE IF NOT EXISTS product_pricing (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    language TEXT NOT NULL, -- 'ar' or 'en'
    offer_order INTEGER NOT NULL, -- 1, 2, 3, 4
    label TEXT NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE product_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on product_pricing"
ON product_pricing FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on product_pricing"
ON product_pricing FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public update on product_pricing"
ON product_pricing FOR UPDATE TO public USING (true);

CREATE POLICY "Allow public delete on product_pricing"
ON product_pricing FOR DELETE TO public USING (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(featured);
CREATE INDEX IF NOT EXISTS idx_product_images_product_id ON product_images(product_id);
CREATE INDEX IF NOT EXISTS idx_product_pricing_product_id ON product_pricing(product_id);

-- ═══════════════════════════════════════════════════════
-- DALAL — Storage Policies for Products Bucket
-- ═══════════════════════════════════════════════════════

-- Allow public to read (SELECT) files from products bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Allow public to upload (INSERT) files
CREATE POLICY "Allow public upload to products bucket"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'products');

-- Allow public to read (SELECT) files
CREATE POLICY "Allow public read from products bucket"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'products');

-- Allow public to update files
CREATE POLICY "Allow public update in products bucket"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'products')
WITH CHECK (bucket_id = 'products');

-- Allow public to delete files
CREATE POLICY "Allow public delete from products bucket"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'products');
