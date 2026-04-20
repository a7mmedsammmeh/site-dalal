/* ═══════════════════════════════════════════════════════════════════
   DALAL — Comprehensive Grants Hardening
   ─────────────────────────────────────────────────────────────────
   Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
   
   Principle: anon should ONLY have the minimum grants needed.
   
   What anon needs (from frontend code analysis):
     ✅ SELECT on products, product_images, product_pricing, product_stock
     ✅ SELECT on reviews (filtered by RLS: is_visible = true)
     ✅ INSERT on reviews (validated by RLS: reviews_guest_insert)
     ✅ SELECT on orders (only used via RPC, but needed if SECURITY INVOKER)
   
   What anon should NOT have:
     ❌ INSERT, UPDATE, DELETE on orders (server-side via /api/)
     ❌ ANY access on visitors (server-side via /api/track-visitor)
     ❌ ANY access on blocked_ips, blocked_phones, blocked_fingerprints (RPC only)
     ❌ ANY access on activity_logs (admin only)
     ❌ ANY access on admins (admin only)
     ❌ INSERT, UPDATE, DELETE on products/* (admin only)
   ═══════════════════════════════════════════════════════════════════ */


-- ═══════════════════════════════════════════════════
-- STEP 1: Revoke ALL from anon and PUBLIC on every table
-- ═══════════════════════════════════════════════════

-- Orders
REVOKE ALL ON public.orders FROM anon;
REVOKE ALL ON public.orders FROM PUBLIC;

-- Visitors
REVOKE ALL ON public.visitors FROM anon;
REVOKE ALL ON public.visitors FROM PUBLIC;

-- Blocked tables
REVOKE ALL ON public.blocked_ips FROM anon;
REVOKE ALL ON public.blocked_ips FROM PUBLIC;
REVOKE ALL ON public.blocked_phones FROM anon;
REVOKE ALL ON public.blocked_phones FROM PUBLIC;
REVOKE ALL ON public.blocked_fingerprints FROM anon;
REVOKE ALL ON public.blocked_fingerprints FROM PUBLIC;

-- Activity logs
REVOKE ALL ON public.activity_logs FROM anon;
REVOKE ALL ON public.activity_logs FROM PUBLIC;

-- Admins
REVOKE ALL ON public.admins FROM anon;
REVOKE ALL ON public.admins FROM PUBLIC;

-- Products (revoke write, keep read)
REVOKE INSERT, UPDATE, DELETE ON public.products FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.products FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.product_images FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_images FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.product_pricing FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_pricing FROM PUBLIC;
REVOKE INSERT, UPDATE, DELETE ON public.product_stock FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.product_stock FROM PUBLIC;

-- Reviews (revoke write except INSERT which is validated by RLS)
REVOKE UPDATE, DELETE ON public.reviews FROM anon;
REVOKE UPDATE, DELETE ON public.reviews FROM PUBLIC;


-- ═══════════════════════════════════════════════════
-- STEP 2: Grant back ONLY what anon needs
-- ═══════════════════════════════════════════════════

-- Products catalog: read-only
GRANT SELECT ON public.products TO anon;
GRANT SELECT ON public.product_images TO anon;
GRANT SELECT ON public.product_pricing TO anon;
GRANT SELECT ON public.product_stock TO anon;

-- Reviews: read + insert (validated by RLS policy)
GRANT SELECT, INSERT ON public.reviews TO anon;

-- Orders: SELECT only (for RPC functions if SECURITY INVOKER)
GRANT SELECT ON public.orders TO anon;


-- ═══════════════════════════════════════════════════
-- STEP 3: Prevent future auto-grants to anon
-- ═══════════════════════════════════════════════════

-- Remove default privileges that auto-grant to anon on new tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM PUBLIC;


-- ═══════════════════════════════════════════════════
-- VERIFICATION: Show all anon grants
-- ═══════════════════════════════════════════════════

SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee = 'anon' AND table_schema = 'public'
ORDER BY table_name, privilege_type;
