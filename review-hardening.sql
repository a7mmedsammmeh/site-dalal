/* ═══════════════════════════════════════════════════════════════════
   DALAL — Review Security Hardening SQL
   ─────────────────────────────────────────────────────────────────
   Run this AFTER deploying the code changes (so /api/submit-review
   is available before removing direct INSERT access)
   
   Fixes:
     1. Revoke INSERT on reviews from anon
        (reviews now go through /api/submit-review with service key)
     2. Drop the reviews_guest_insert policy (no longer needed)
   ═══════════════════════════════════════════════════════════════════ */


-- ═══════════════════════════════════════════════════════════════
-- Step 1: Revoke INSERT grant from anon on reviews
-- ═══════════════════════════════════════════════════════════════
REVOKE INSERT ON public.reviews FROM anon;
REVOKE INSERT ON public.reviews FROM PUBLIC;

-- Re-grant SELECT (still needed for public review display)
GRANT SELECT ON public.reviews TO anon;


-- ═══════════════════════════════════════════════════════════════
-- Step 2: Drop the anon INSERT policy (no longer needed)
-- Reviews are now submitted via /api/submit-review using service key
-- ═══════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "reviews_guest_insert" ON public.reviews;


-- ═══════════════════════════════════════════════════════════════
-- Verification
-- ═══════════════════════════════════════════════════════════════
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename = 'reviews'
ORDER BY policyname;
