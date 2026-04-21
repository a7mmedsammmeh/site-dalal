-- ═══════════════════════════════════════════════════════════════
-- DALAL — Site Settings Table (for maintenance mode, etc.)
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

-- Create site_settings table
CREATE TABLE IF NOT EXISTS public.site_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Insert default maintenance_mode setting (OFF by default)
INSERT INTO public.site_settings (key, value)
VALUES ('maintenance_mode', '{"enabled": false, "message": "الموقع تحت الصيانة حالياً. سنعود قريباً!"}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- RLS: Allow anyone to READ settings (needed for maintenance check)
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site_settings"
    ON public.site_settings
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Only admin can UPDATE (uses is_admin() RPC)
CREATE POLICY "Admins can update site_settings"
    ON public.site_settings
    FOR UPDATE
    TO authenticated
    USING ((SELECT is_admin()))
    WITH CHECK ((SELECT is_admin()));

-- No INSERT/DELETE allowed (settings are pre-seeded)
CREATE POLICY "No insert on site_settings"
    ON public.site_settings
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (false);

CREATE POLICY "No delete on site_settings"
    ON public.site_settings
    FOR DELETE
    TO anon, authenticated
    USING (false);

-- Grant SELECT to anon for public access, UPDATE only to authenticated (admin enforced by RLS)
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT, UPDATE ON public.site_settings TO authenticated;
