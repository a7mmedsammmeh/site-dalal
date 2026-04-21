-- ═══════════════════════════════════════════════════════════════
-- DALAL — Security Limits Settings
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.site_settings (key, value)
VALUES (
    'security_limits',
    '{
        "order_max_per_ip": 3,
        "order_window_min": 10,
        "phone_cooldown_min": 2,
        "duplicate_window_min": 2,
        "review_max_per_ip": 10,
        "review_window_hours": 24,
        "max_items_per_order": 20
    }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
