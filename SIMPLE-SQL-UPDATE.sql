-- ═══════════════════════════════════════════════════════
-- DALAL — Simple SQL Update for Enhanced Features
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- Add display_order column to products table for drag & drop sorting
ALTER TABLE products ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

-- Create index for faster sorting
CREATE INDEX IF NOT EXISTS idx_products_display_order ON products(display_order);

-- That's it! ✅
