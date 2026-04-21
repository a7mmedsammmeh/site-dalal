/* ═══════════════════════════════════════════════════════════════
   DALAL — Check Maintenance Mode (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-maintenance

   Maintenance is a SITE-LEVEL decision, not security-critical.
   Fail-open preserved: if we can't check, let visitors in.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, createMemoryRateLimiter,
    checkGlobalRateLimit, supabaseGet, TIMEOUT
} from './_lib/security.js';

/* ── Rate limiter: max 20 checks per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 20 });

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Global + per-endpoint rate limiting ── */
    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    if (rateLimiter.check(ip)) {
        return res.status(200).json({ maintenance: false });
    }

    try {
        const data = await supabaseGet(
            'site_settings',
            'key=eq.maintenance_mode&select=value',
            TIMEOUT.DB_READ
        );

        if (!data || data.length === 0) {
            return res.status(200).json({ maintenance: false });
        }

        const val = data[0].value || {};
        return res.status(200).json({
            maintenance: val.enabled === true,
            message: val.message || null
        });

    } catch {
        // Maintenance check is non-critical — fail open
        return res.status(200).json({ maintenance: false });
    }
}
