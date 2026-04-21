/* ═══════════════════════════════════════════════════════════════
   DALAL — Check Phone Block Status (Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-phone?phone=xxxx
   
   Returns { blocked: true/false } — NO reason exposed.
   Uses normalized_phone column for indexed lookup (no full scan).
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    normalizePhone, supabaseGet, createMemoryRateLimiter
} from './_lib/security.js';

/* ── Rate limiter: max 10 checks per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 10 });

export default async function handler(req, res) {
    /* ── CORS (strict) ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Bot detection ── */
    if (isBot(req)) {
        // Return consistent response to avoid revealing detection
        return res.status(200).json({ blocked: false });
    }

    /* ── Rate limiting ── */
    const ip = getServerIP(req);
    if (rateLimiter.check(ip)) {
        return res.status(200).json({ blocked: false }); // consistent response
    }

    const phone = req.query.phone || null;
    if (!phone) return res.status(200).json({ blocked: false });

    // Validate phone format (basic)
    if (typeof phone !== 'string' || phone.length > 20) {
        return res.status(200).json({ blocked: false });
    }

    try {
        const normalizedInput = normalizePhone(phone);
        if (!normalizedInput || normalizedInput.length < 9) {
            return res.status(200).json({ blocked: false });
        }

        // Indexed query on normalized_phone column (NO full-table scan)
        const result = await supabaseGet(
            'blocked_phones',
            `normalized_phone=eq.${encodeURIComponent(normalizedInput)}&select=id&limit=1`
        );
        return res.status(200).json({ blocked: result.length > 0 });

    } catch {
        // Fail safe — don't block legitimate users on error
        return res.status(200).json({ blocked: false });
    }
}
