-- ═══════════════════════════════════════════════════════
-- DALAL — Blocked Phones & Device Fingerprints
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- 1. Blocked Phone Numbers
CREATE TABLE IF NOT EXISTS blocked_phones (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    phone TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blocked_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on blocked_phones"
ON blocked_phones FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on blocked_phones"
ON blocked_phones FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public delete on blocked_phones"
ON blocked_phones FOR DELETE TO public USING (true);

-- 2. Blocked Device Fingerprints
CREATE TABLE IF NOT EXISTS blocked_fingerprints (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fingerprint TEXT NOT NULL UNIQUE,
    reason TEXT,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE blocked_fingerprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select on blocked_fingerprints"
ON blocked_fingerprints FOR SELECT TO public USING (true);

CREATE POLICY "Allow public insert on blocked_fingerprints"
ON blocked_fingerprints FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Allow public delete on blocked_fingerprints"
ON blocked_fingerprints FOR DELETE TO public USING (true);
