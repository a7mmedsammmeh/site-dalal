-- ═══════════════════════════════════════════════════════════════
-- DALAL — Linter Warnings Fix
-- ═══════════════════════════════════════════════════════════════
-- Fixes 4 Supabase database linter warnings:
--   1. validate_order_prices — missing search_path
--   2. activity_logs_guest_insert — unrestricted INSERT
--   3. reviews_guest_insert — unrestricted INSERT
--   4. products bucket — public listing allowed
--
-- Warning #5 (Leaked Password Protection) → enable from Dashboard
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- FIX 1: validate_order_prices — Set search_path
-- ─────────────────────────────────────────────────────────────
-- Without search_path, a malicious user could create a schema
-- with a fake table name and trick the function into reading it.

ALTER FUNCTION public.validate_order_prices()
SET search_path = public;


-- ─────────────────────────────────────────────────────────────
-- FIX 2: activity_logs_guest_insert — Restrict INSERT
-- ─────────────────────────────────────────────────────────────
-- Currently: WITH CHECK (true) → anyone can spam unlimited logs
-- Fix: Only allow valid action_type values + limit field sizes

DROP POLICY IF EXISTS "activity_logs_guest_insert" ON public.activity_logs;
CREATE POLICY "activity_logs_guest_insert" ON public.activity_logs
    FOR INSERT TO anon
    WITH CHECK (
        -- Only allow known action types
        action_type IN ('create', 'update', 'delete', 'delete_all', 'block', 'unblock')
        -- Description is required and has a max length
        AND action_description IS NOT NULL
        AND length(action_description) <= 500
        -- Entity type must be short if provided
        AND (entity_type IS NULL OR length(entity_type) <= 50)
        -- Entity ID must be short if provided
        AND (entity_id IS NULL OR length(entity_id) <= 100)
    );


-- ─────────────────────────────────────────────────────────────
-- FIX 3: reviews_guest_insert — Restrict INSERT
-- ─────────────────────────────────────────────────────────────
-- Currently: WITH CHECK (true) → anyone can spam fake reviews
-- Fix: Validate rating range, limit text sizes, force hidden

DROP POLICY IF EXISTS "reviews_guest_insert" ON public.reviews;
CREATE POLICY "reviews_guest_insert" ON public.reviews
    FOR INSERT TO anon
    WITH CHECK (
        -- Rating must be 1-5
        rating >= 1 AND rating <= 5
        -- Reviewer name: optional but max 100 chars
        AND (reviewer_name IS NULL OR length(reviewer_name) <= 100)
        -- Comment: optional but max 1000 chars
        AND (comment IS NULL OR length(comment) <= 1000)
        -- New reviews MUST be hidden (admin approves later)
        AND is_visible = false
        -- Order ref: optional but max 50 chars
        AND (order_ref IS NULL OR length(order_ref) <= 50)
    );


-- ─────────────────────────────────────────────────────────────
-- FIX 4: products bucket — Restrict listing to admin only
-- ─────────────────────────────────────────────────────────────
-- Currently: broad SELECT policy lets anyone list ALL files
-- Fix: Only admin can list. Public URLs still work for images.
--
-- ⚠️ NOTE: This uses public.is_admin() from admin-security.sql.
-- Make sure you've already run admin-security.sql first!

DROP POLICY IF EXISTS "products_bucket_admin_all" ON storage.objects;

-- Admin-only: full access (list, upload, delete)
CREATE POLICY "products_bucket_admin_all" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'products' AND public.is_admin())
    WITH CHECK (bucket_id = 'products' AND public.is_admin());


-- ─────────────────────────────────────────────────────────────
-- FIX 5: Leaked Password Protection
-- ─────────────────────────────────────────────────────────────
-- ⚠️ This CANNOT be fixed via SQL. Enable it from:
--    Supabase Dashboard → Authentication → Settings → Security
--    → Enable "Leaked Password Protection"
-- ─────────────────────────────────────────────────────────────
