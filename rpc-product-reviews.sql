-- ═══════════════════════════════════════════════════════════════
-- RPC: get_product_reviews
-- Returns safe review data for a specific product.
--
-- ⚠️ SECURITY:
--   - Replaces direct SELECT * on reviews table
--   - Returns ONLY safe columns (no client_ip, no raw order_ref)
--   - order_ref is converted to boolean is_verified
--   - Only visible reviews are returned
--   - SECURITY DEFINER bypasses RLS — function controls what's exposed
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_product_reviews(p_product_id int)
RETURNS TABLE (
    rating        int,
    comment       text,
    reviewer_name text,
    created_at    timestamptz,
    is_pinned     boolean,
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
        r.is_pinned,
        (r.order_ref IS NOT NULL) AS is_verified
    FROM public.reviews r
    WHERE r.product_id = p_product_id
      AND r.is_visible = true
    ORDER BY r.created_at DESC
    LIMIT 50;
$$;

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_product_reviews(int) TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_reviews(int) TO authenticated;
