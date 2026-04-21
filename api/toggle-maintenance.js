/* ═══════════════════════════════════════════════════════════════
   DALAL — Toggle Maintenance Mode (Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/toggle-maintenance  { enabled: true/false }
   
   Admin-only endpoint.
   Hardened:
   - Strict CORS (no wildcard)
   - No hardcoded keys
   - Uses service key for DB operations
   - Consistent admin verification
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, verifyAdmin,
    supabaseGet, supabasePatch
} from './_lib/security.js';

export default async function handler(req, res) {
    /* ── CORS (strict — no wildcard) ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        /* ── Admin verification ── */
        const admin = await verifyAdmin(req);
        if (!admin.valid) {
            return res.status(admin.status).json({ error: admin.error });
        }

        /* ── Validate input ── */
        const { enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: '"enabled" must be a boolean' });
        }

        /* ── Get current settings to preserve message ── */
        let currentValue = {};
        try {
            const data = await supabaseGet(
                'site_settings',
                'key=eq.maintenance_mode&select=value'
            );
            if (data && data.length > 0) {
                currentValue = data[0].value || {};
            }
        } catch { /* proceed with empty */ }

        const newValue = {
            ...currentValue,
            enabled: enabled,
        };

        /* ── Update using service key ── */
        const success = await supabasePatch(
            'site_settings',
            'key=eq.maintenance_mode',
            { value: newValue, updated_at: new Date().toISOString() }
        );

        if (!success) {
            return res.status(500).json({ error: 'Failed to update maintenance mode' });
        }

        return res.status(200).json({
            success: true,
            maintenance: enabled
        });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
