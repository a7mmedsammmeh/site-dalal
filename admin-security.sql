-- ═══════════════════════════════════════════════════════════════
-- DALAL — Admin Security Hardening
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- WHAT THIS DOES:
--   1. Creates 'admins' table for role-based access
--   2. Creates 'is_admin()' helper function
--   3. Updates ALL admin RLS policies to use is_admin() check
--      instead of just checking 'authenticated' role
--
-- ⚠️ IMPORTANT: After running this, you MUST insert your user:
--   INSERT INTO public.admins (user_id) VALUES ('YOUR-AUTH-UID');
--   Find your UID: Supabase Dashboard → Authentication → Users
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- STEP 1: Create admins table
-- ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.admins (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS with NO policies = no client can read/write this table directly
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies on admins table.
-- Only SECURITY DEFINER functions can access it.


-- ─────────────────────────────────────────────────────────────
-- STEP 2: Create is_admin() helper function
-- ─────────────────────────────────────────────────────────────
-- Returns true if current authenticated user is in admins table.
-- SECURITY DEFINER = runs as DB owner, can read admins table.
-- STABLE = result doesn't change within a transaction (cacheable).

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.admins WHERE user_id = auth.uid()
    );
$$;

-- Grant execute to authenticated (needed for frontend role check)
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
-- Anon gets false automatically (auth.uid() returns null for anon)
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;


-- ─────────────────────────────────────────────────────────────
-- STEP 3: Update RLS policies to require admin role
-- ─────────────────────────────────────────────────────────────
-- Pattern: DROP old policy → CREATE new one with is_admin() check


-- ── 3a. ORDERS ──
DROP POLICY IF EXISTS "orders_admin_all" ON public.orders;
CREATE POLICY "orders_admin_all" ON public.orders
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3b. VISITORS ──
DROP POLICY IF EXISTS "visitors_admin_all" ON public.visitors;
CREATE POLICY "visitors_admin_all" ON public.visitors
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3c. BLOCKED IPs ──
DROP POLICY IF EXISTS "blocked_ips_admin_all" ON public.blocked_ips;
CREATE POLICY "blocked_ips_admin_all" ON public.blocked_ips
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3d. BLOCKED PHONES ──
DROP POLICY IF EXISTS "blocked_phones_admin_all" ON public.blocked_phones;
CREATE POLICY "blocked_phones_admin_all" ON public.blocked_phones
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3e. BLOCKED FINGERPRINTS ──
DROP POLICY IF EXISTS "blocked_fp_admin_all" ON public.blocked_fingerprints;
CREATE POLICY "blocked_fp_admin_all" ON public.blocked_fingerprints
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());


-- ── 3f. ACTIVITY LOGS (admin read/delete) ──
DROP POLICY IF EXISTS "activity_logs_admin_all" ON public.activity_logs;
CREATE POLICY "activity_logs_admin_all" ON public.activity_logs
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep guest INSERT for logging (allow anon to insert activity logs)
-- Policy "activity_logs_guest_insert" should remain untouched.


-- ── 3g. REVIEWS (admin management) ──
DROP POLICY IF EXISTS "reviews_admin_all" ON public.reviews;
CREATE POLICY "reviews_admin_all" ON public.reviews
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep public read (is_visible) and guest insert policies untouched:
-- "allow_public_select_reviews" — public can read visible reviews
-- "reviews_guest_insert" — guests can submit reviews


-- ── 3h. PRODUCTS (admin management) ──
DROP POLICY IF EXISTS "products_admin_all" ON public.products;
CREATE POLICY "products_admin_all" ON public.products
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep "products_public_read" untouched (public catalog)


-- ── 3i. PRODUCT IMAGES (admin management) ──
DROP POLICY IF EXISTS "product_images_admin_all" ON public.product_images;
CREATE POLICY "product_images_admin_all" ON public.product_images
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep "product_images_public_read" untouched


-- ── 3j. PRODUCT PRICING (admin management) ──
DROP POLICY IF EXISTS "product_pricing_admin_all" ON public.product_pricing;
CREATE POLICY "product_pricing_admin_all" ON public.product_pricing
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep "product_pricing_public_read" untouched


-- ── 3k. PRODUCT STOCK (admin management) ──
DROP POLICY IF EXISTS "product_stock_admin_all" ON public.product_stock;
CREATE POLICY "product_stock_admin_all" ON public.product_stock
    FOR ALL TO authenticated
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

-- ⚠️ Keep "product_stock_public_read" untouched


-- ─────────────────────────────────────────────────────────────
-- STEP 4: INSERT YOUR ADMIN USER
-- ─────────────────────────────────────────────────────────────
-- ⚠️ UNCOMMENT AND REPLACE with your actual auth.users UUID:
--
-- INSERT INTO public.admins (user_id)
-- VALUES ('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx');
--
-- Find your UID: Supabase Dashboard → Authentication → Users
-- ─────────────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────────────
-- VERIFICATION: Run these after inserting your admin user
-- ─────────────────────────────────────────────────────────────
-- SELECT * FROM public.admins;
-- SELECT public.is_admin();  -- should return true when logged in as admin
