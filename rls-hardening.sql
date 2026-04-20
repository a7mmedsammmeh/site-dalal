-- ═══════════════════════════════════════════════════════════════
-- DALAL — RLS Security Hardening
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- WHAT THIS DOES:
--   1. Drops ALL unsafe public/anon SELECT policies
--   2. Creates secure RPC functions for public lookups
--   3. Fixes reviews visibility leak
--   4. Keeps all admin + safe policies untouched
--
-- ⚠️ BACKUP: Supabase has point-in-time recovery, but
--    screenshot your current policies first just in case.
-- ═══════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────
-- STEP 1: DROP ALL UNSAFE POLICIES
-- ─────────────────────────────────────────────────────────────

-- ❌ orders: 3 anon SELECT with USING(true) = FULL DATA LEAK
DROP POLICY IF EXISTS "orders_anon_select"           ON public.orders;
DROP POLICY IF EXISTS "allow_anon_select_own"        ON public.orders;
DROP POLICY IF EXISTS "Allow anon to read own order by ref" ON public.orders;

-- ❌ orders: redundant authenticated SELECT (already covered by orders_admin_all)
DROP POLICY IF EXISTS "admin_read"                   ON public.orders;

-- ❌ visitors: public SELECT = leaks IP, fingerprint, pages visited
DROP POLICY IF EXISTS "Allow public select on visitors" ON public.visitors;
-- ❌ visitors: redundant auth SELECT (covered by visitors_admin_all)
DROP POLICY IF EXISTS "allow auth select"            ON public.visitors;

-- ❌ blocked_ips: public SELECT = attacker sees which IPs are blocked
DROP POLICY IF EXISTS "Allow public select on blocked_ips" ON public.blocked_ips;

-- ❌ blocked_phones: public SELECT = leaks blocked phone numbers
DROP POLICY IF EXISTS "Allow public select on blocked_phones" ON public.blocked_phones;

-- ❌ blocked_fingerprints: public SELECT = leaks fingerprint data
DROP POLICY IF EXISTS "Allow public select on blocked_fingerprints" ON public.blocked_fingerprints;

-- ❌ activity_logs: public SELECT = leaks all admin actions, IPs, details
DROP POLICY IF EXISTS "Allow public select on activity_logs" ON public.activity_logs;

-- ❌ reviews: USING(true) overrides the safe is_visible policy (OR logic)
DROP POLICY IF EXISTS "reviews_public_read"          ON public.reviews;


-- ─────────────────────────────────────────────────────────────
-- STEP 2: CREATE SECURE RPC FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- ── 2a. Order tracking (replaces anon SELECT on orders) ──
-- Returns ONLY safe columns for a single order by ref.
-- SECURITY DEFINER = runs as DB owner, bypasses RLS.
-- This is intentional: the function itself enforces what data is returned.
CREATE OR REPLACE FUNCTION public.get_order_by_ref(p_ref text)
RETURNS TABLE (
    order_ref   text,
    status      text,
    products    jsonb,
    total       numeric,
    created_at  timestamptz,
    cancel_reason text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT order_ref, status, products, total, created_at, cancel_reason
    FROM public.orders
    WHERE order_ref = p_ref
    LIMIT 1;
$$;

-- Grant anon access to call this function
GRANT EXECUTE ON FUNCTION public.get_order_by_ref(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_by_ref(text) TO authenticated;


-- ── 2b. IP block check (replaces anon SELECT on blocked_ips) ──
CREATE OR REPLACE FUNCTION public.is_ip_blocked(p_ip text)
RETURNS TABLE (blocked boolean, reason text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        true AS blocked,
        bi.reason
    FROM public.blocked_ips bi
    WHERE bi.ip = p_ip
    LIMIT 1;
$$;
-- Returns empty set if not blocked, one row if blocked

GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_ip_blocked(text) TO authenticated;


-- ── 2c. Phone block check (replaces anon SELECT on blocked_phones) ──
CREATE OR REPLACE FUNCTION public.is_phone_blocked(p_phone text)
RETURNS TABLE (blocked boolean, reason text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        true AS blocked,
        bp.reason
    FROM public.blocked_phones bp
    WHERE bp.phone = p_phone
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_phone_blocked(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_phone_blocked(text) TO authenticated;


-- ── 2d. Fingerprint block check (replaces anon SELECT on blocked_fingerprints) ──
CREATE OR REPLACE FUNCTION public.is_fingerprint_blocked(p_fp text)
RETURNS TABLE (blocked boolean, reason text)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        true AS blocked,
        bf.reason
    FROM public.blocked_fingerprints bf
    WHERE bf.fingerprint = p_fp
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.is_fingerprint_blocked(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_fingerprint_blocked(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────
-- STEP 3: VERIFY — These policies REMAIN (DO NOT TOUCH)
-- ─────────────────────────────────────────────────────────────
-- ✅ orders:              orders_admin_all (authenticated ALL)
-- ✅ orders:              allow_anon_cancel_pending (anon UPDATE, restricted)
-- ✅ visitors:            visitors_guest_insert (anon INSERT)
-- ✅ visitors:            visitors_admin_all (authenticated ALL)
-- ✅ activity_logs:       activity_logs_guest_insert (anon INSERT)
-- ✅ activity_logs:       activity_logs_admin_all (authenticated ALL)
-- ✅ blocked_ips:         blocked_ips_admin_all (authenticated ALL)
-- ✅ blocked_phones:      blocked_phones_admin_all (authenticated ALL)
-- ✅ blocked_fingerprints: blocked_fp_admin_all (authenticated ALL)
-- ✅ reviews:             allow_public_select_reviews (is_visible = true)
-- ✅ reviews:             reviews_guest_insert (anon INSERT)
-- ✅ reviews:             reviews_admin_all (authenticated ALL)
-- ✅ products:            products_public_read + products_admin_all
-- ✅ product_images:      product_images_public_read + product_images_admin_all
-- ✅ product_pricing:     product_pricing_public_read + product_pricing_admin_all
-- ✅ product_stock:       product_stock_public_read + product_stock_admin_all
