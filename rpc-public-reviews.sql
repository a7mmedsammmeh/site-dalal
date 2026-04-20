-- ═══════════════════════════════════════════════════════════════
-- RPC: get_public_reviews
-- Returns safe review data for the homepage reviews slider.
-- NOT product-specific — returns all visible reviews across products.
--
-- ⚠️ SECURITY:
--   - Replaces direct SELECT * on reviews table from index.html
--   - Returns ONLY safe columns (no client_ip, no order_ref, no internal IDs)
--   - order_ref is converted to boolean is_verified
--   - Only visible reviews are returned
--   - Capped at 30 results server-side
--   - SECURITY DEFINER bypasses RLS — function controls what's exposed
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_public_reviews()
RETURNS TABLE (
    rating        int,
    comment       text,
    reviewer_name text,
    created_at    timestamptz,
    is_verified   boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        r.rating,
        r.comment,
        r.reviewer_name,
        r.created_at,
        (r.order_ref IS NOT NULL) AS is_verified
    FROM public.reviews r
    WHERE r.is_visible = true
    ORDER BY r.created_at DESC
    LIMIT 30;
$$;

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_public_reviews() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_reviews() TO authenticated;
