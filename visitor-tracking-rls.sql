-- ═══════════════════════════════════════════════════════════════
-- DALAL — Disable Client-Side Visitor Inserts (RLS)
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor AFTER deploying the
-- /api/track-visitor endpoint.
--
-- WHAT THIS DOES:
--   Drops the anon INSERT policy on visitors table.
--   The server uses SUPABASE_SERVICE_KEY (bypasses RLS) so
--   server-side inserts continue working normally.
--
-- WHAT STAYS:
--   ✅ visitors_admin_all (authenticated ALL) — admin dashboard
--   ✅ Server-side inserts via service key — /api/track-visitor
--
-- ⚠️ After running this, the browser console command:
--    supabase.from('visitors').insert({...})
--    will FAIL with RLS error. This is intentional.
-- ═══════════════════════════════════════════════════════════════

-- ❌ Remove anon INSERT — visitors are now tracked via /api/track-visitor
DROP POLICY IF EXISTS "visitors_guest_insert" ON public.visitors;

-- Verify: Only these policies should remain on visitors:
-- ✅ visitors_admin_all (authenticated ALL)
-- No public/anon policies at all.
