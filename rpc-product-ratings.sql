-- ═══════════════════════════════════════════════════════════════
-- RPC: get_product_ratings
-- Returns aggregated ratings (avg + count) for given product IDs.
-- Only counts visible reviews (is_visible = true).
--
-- ⚠️ SECURITY: This replaces direct SELECT on reviews table.
-- It exposes ONLY aggregate data — no comments, names, or IPs.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_product_ratings(p_ids int[])
RETURNS TABLE (
    product_id  int,
    avg_rating  numeric,
    review_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT
        r.product_id,
        ROUND(AVG(r.rating)::numeric, 1)  AS avg_rating,
        COUNT(*)                           AS review_count
    FROM public.reviews r
    WHERE r.product_id = ANY(p_ids)
      AND r.is_visible = true
    GROUP BY r.product_id;
$$;

-- Grant access to anon and authenticated roles
GRANT EXECUTE ON FUNCTION public.get_product_ratings(int[]) TO anon;
GRANT EXECUTE ON FUNCTION public.get_product_ratings(int[]) TO authenticated;
