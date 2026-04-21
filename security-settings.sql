-- ═══════════════════════════════════════════════════════════════
-- DALAL — Security Limits Settings
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════════

INSERT INTO public.site_settings (key, value)
VALUES (
    'security_limits',
    '{
        "order_max_per_ip": 3,
        "order_window_time": 10,
        "order_window_unit": "minutes",
        "phone_cooldown_time": 2,
        "phone_cooldown_unit": "minutes",
        "duplicate_window_time": 2,
        "duplicate_window_unit": "minutes",
        "review_max_per_ip": 10,
        "review_window_time": 24,
        "review_window_unit": "hours",
        "max_items_per_order": 20,
        "pwa_cooldown_enabled": true,
        "pwa_cooldown_time": 1,
        "pwa_cooldown_unit": "weeks"
    }'::jsonb
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
