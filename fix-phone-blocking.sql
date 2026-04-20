-- ═══════════════════════════════════════════════════════════════
-- DALAL — Fix Phone Blocking (Normalize All Formats)
-- ═══════════════════════════════════════════════════════════════
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
--
-- PROBLEM: If admin blocks 01221808060, customer can bypass
--          by entering +201221808060 or 201221808060 etc.
--
-- SOLUTION: Normalize all phone numbers before comparing.
--           Strip: +20, 0020, 002, +2, leading 0
--           Result: core digits like 1221808060
-- ═══════════════════════════════════════════════════════════════


-- ── Helper: Normalize Egyptian phone number ──
-- Strips country codes and leading zeros to get core digits.
-- Examples:
--   01221808060   → 1221808060
--   +201221808060 → 1221808060
--   201221808060  → 1221808060
--   00201221808060→ 1221808060
--   1221808060    → 1221808060

CREATE OR REPLACE FUNCTION public.normalize_phone(p_phone text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    cleaned text;
BEGIN
    -- Remove all non-digit characters (spaces, dashes, parentheses, +)
    cleaned := regexp_replace(p_phone, '[^0-9]', '', 'g');
    
    -- Strip leading 0020 (international dial with 00)
    IF cleaned LIKE '0020%' AND length(cleaned) >= 14 THEN
        cleaned := substring(cleaned FROM 5);
    -- Strip leading 20 (country code) — only if result is 10 digits (valid Egyptian mobile)
    ELSIF cleaned LIKE '20%' AND length(cleaned) >= 12 THEN
        cleaned := substring(cleaned FROM 3);
    END IF;
    
    -- Strip single leading 0 (local format 01xxxxxxxxx → 1xxxxxxxxx)
    IF cleaned LIKE '0%' AND length(cleaned) >= 11 THEN
        cleaned := substring(cleaned FROM 2);
    END IF;
    
    RETURN cleaned;
END;
$$;


-- ── Updated: Phone block check with normalization ──
-- Now compares normalized versions of both stored and input phones.
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
    WHERE public.normalize_phone(bp.phone) = public.normalize_phone(p_phone)
    LIMIT 1;
$$;

-- Keep existing grants
GRANT EXECUTE ON FUNCTION public.is_phone_blocked(text) TO anon;
GRANT EXECUTE ON FUNCTION public.is_phone_blocked(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO anon;
GRANT EXECUTE ON FUNCTION public.normalize_phone(text) TO authenticated;
