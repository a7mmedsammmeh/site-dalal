/* ═══════════════════════════════════════════════════════════════
   DALAL — Security Settings API (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   GET  /api/security-settings  — Fetch current limits (admin only)
   POST /api/security-settings  — Update limits (admin only)

   Admin-only. FAIL CLOSED on all errors.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, verifyAdmin, getServerIP,
    supabaseGet, supabasePatch,
    checkGlobalRateLimit, logSecurityEvent
} from './_lib/security.js';

/* ── Allowed settings whitelist with validation rules ── */
const SETTINGS_SCHEMA = {
    order_max_per_ip:         { type: 'number', min: 0, max: 999999 },
    order_window_time:        { type: 'number', min: 0, max: 999999 },
    phone_cooldown_time:      { type: 'number', min: 0, max: 999999 },
    duplicate_window_time:    { type: 'number', min: 0, max: 999999 },
    max_items_per_order:      { type: 'number', min: 1, max: 999999 },
    review_window_time:       { type: 'number', min: 0, max: 999999 },
    review_max_per_ip:        { type: 'number', min: 0, max: 999999 },
    pwa_cooldown_time:        { type: 'number', min: 0, max: 999999 },

    order_window_unit:        { type: 'unit' },
    phone_cooldown_unit:      { type: 'unit' },
    duplicate_window_unit:    { type: 'unit' },
    review_window_unit:       { type: 'unit' },
    pwa_cooldown_unit:        { type: 'unit' },

    pwa_cooldown_enabled:     { type: 'boolean' }
};

const ALLOWED_UNITS = ['minutes', 'hours', 'days', 'weeks'];

function validateSettings(input) {
    if (!input || typeof input !== 'object') return { valid: false, error: 'Invalid input' };
    if (Array.isArray(input)) return { valid: false, error: 'Invalid input format' };

    const validated = {};

    for (const [key, value] of Object.entries(input)) {
        const schema = SETTINGS_SCHEMA[key];
        if (!schema) continue;

        if (schema.type === 'number') {
            const num = Number(value);
            if (!Number.isInteger(num) || num < schema.min || num > schema.max) {
                return { valid: false, error: `${key} must be an integer between ${schema.min} and ${schema.max}` };
            }
            validated[key] = num;
        } else if (schema.type === 'unit') {
            if (typeof value !== 'string' || !ALLOWED_UNITS.includes(value)) {
                return { valid: false, error: `${key} must be one of: ${ALLOWED_UNITS.join(', ')}` };
            }
            validated[key] = value;
        } else if (schema.type === 'boolean') {
            if (typeof value !== 'boolean') {
                return { valid: false, error: `${key} must be boolean` };
            }
            validated[key] = value;
        }
    }

    if (Object.keys(validated).length === 0) {
        return { valid: false, error: 'No valid settings provided' };
    }

    return { valid: true, data: validated };
}

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    /* ── Global rate limiting ── */
    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    try {
        /* ── Admin verification (FAIL CLOSED) ── */
        const admin = await verifyAdmin(req);
        if (!admin.valid) {
            return res.status(admin.status).json({ error: admin.error });
        }

        /* ── GET: Fetch current settings ── */
        if (req.method === 'GET') {
            const data = await supabaseGet(
                'site_settings',
                'key=eq.security_limits&select=value'
            );

            if (!data || data.length === 0) {
                return res.status(404).json({ error: 'No limits configured' });
            }

            return res.status(200).json({ success: true, limits: data[0].value || {} });
        }

        /* ── POST: Update settings ── */
        if (req.method === 'POST') {
            const newLimits = req.body;

            const validation = validateSettings(newLimits);
            if (!validation.valid) {
                return res.status(400).json({ error: validation.error });
            }

            let existing = {};
            try {
                const current = await supabaseGet(
                    'site_settings',
                    'key=eq.security_limits&select=value'
                );
                if (current && current.length > 0) {
                    existing = current[0].value || {};
                }
            } catch { /* proceed with empty */ }

            const merged = { ...existing, ...validation.data };

            const success = await supabasePatch(
                'site_settings',
                'key=eq.security_limits',
                { value: merged, updated_at: new Date().toISOString() }
            );

            if (!success) {
                return res.status(500).json({ error: 'Failed to update settings' });
            }

            logSecurityEvent('info', 'settings:updated', { ip, detail: JSON.stringify(validation.data).slice(0, 200) });

            return res.status(200).json({ success: true, limits: merged });
        }

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
