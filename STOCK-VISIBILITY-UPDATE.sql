-- ═══════════════════════════════════════════════════════════════
-- DALAL — Stock Visibility Update
-- Add visibility_status column to product_stock table
-- ═══════════════════════════════════════════════════════════════

-- Add visibility_status column if it doesn't exist
ALTER TABLE product_stock 
ADD COLUMN IF NOT EXISTS visibility_status TEXT DEFAULT 'visible' 
CHECK (visibility_status IN ('visible', 'out_of_stock', 'hidden'));

-- Update existing rows to have 'visible' status if in_stock is true
-- and 'out_of_stock' if in_stock is false
UPDATE product_stock 
SET visibility_status = CASE 
    WHEN in_stock = true THEN 'visible'
    ELSE 'out_of_stock'
END
WHERE visibility_status IS NULL;

-- Note: 
-- 'visible' = Product is available and shows normally
-- 'out_of_stock' = Product shows but with "out of stock" message instead of buy buttons
-- 'hidden' = Product is completely hidden from the website
