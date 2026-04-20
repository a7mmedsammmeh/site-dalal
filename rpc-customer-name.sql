-- ═══════════════════════════════════════════════════════════════
-- DALAL — RPC: Get Customer Name by Order Ref
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor
--
-- Returns ONLY the customer name for a given order reference.
-- Used by the review page to auto-fill the reviewer name
-- so the customer doesn't have to type it again.
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_order_customer_name(p_ref text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT name
    FROM public.orders
    WHERE order_ref = p_ref
    LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_order_customer_name(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_order_customer_name(text) TO authenticated;
