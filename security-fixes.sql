/* ═══════════════════════════════════════════════════════════════════
   DALAL — Security Fixes SQL
   ─────────────────────────────────────────────────────────────────
   Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
   
   Fixes:
     1. Remove allow_anon_cancel_pending (orders — anon UPDATE)
     2. Remove public Storage write policies (INSERT/UPDATE/DELETE)
     3. Remove activity_logs_guest_insert (anon INSERT on activity_logs)
   ═══════════════════════════════════════════════════════════════════ */


-- ═══════════════════════════════════════════════════════════════════
-- FIX 1: Remove anon cancel policy on orders
-- ─────────────────────────────────────────────────────────────────
-- WHY: This policy allows ANY anonymous user to:
--   a) Cancel any pending order if they know the order_ref
--   b) Modify OTHER columns (name, phone, address, etc.) alongside
--      the status change, because WITH CHECK only validates status
-- REPLACEMENT: /api/cancel-order (server-side, uses service key,
--   only changes the status field)
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "allow_anon_cancel_pending" ON public.orders;


-- ═══════════════════════════════════════════════════════════════════
-- FIX 2: Remove public Storage write policies
-- ─────────────────────────────────────────────────────────────────
-- WHY: These 3 policies allow ANY visitor (even without auth) to:
--   - Upload arbitrary files to the products bucket
--   - Modify existing product images
--   - Delete all product images
--   Using only the publicly-exposed anon key from supabase.js
-- KEEP: products_bucket_admin_all (authenticated + is_admin())
-- NOTE: Public READ is handled by the bucket's public setting,
--   not by RLS policies. So product images remain publicly viewable.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Allow public upload to products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public update in products bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete from products bucket" ON storage.objects;


-- ═══════════════════════════════════════════════════════════════════
-- FIX 3: Remove anon INSERT on activity_logs
-- ─────────────────────────────────────────────────────────────────
-- WHY: The code already uses _requireAdmin() for all activity log
--   writes, but the RLS policy allows ANY anon to INSERT logs.
--   An attacker could use the anon key to spam the activity_logs
--   table with fake entries.
-- The admin-only policy (activity_logs_admin_all) already covers
--   authenticated admin INSERT, so removing this is safe.
-- ═══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "activity_logs_guest_insert" ON public.activity_logs;


-- ═══════════════════════════════════════════════════════════════════
-- VERIFICATION: List remaining policies to confirm
-- ═══════════════════════════════════════════════════════════════════

SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE schemaname IN ('public', 'storage')
ORDER BY tablename, policyname;
