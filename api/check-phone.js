/* ═══════════════════════════════════════════════════════════════
   DALAL — Check Phone Block Status (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-phone?phone=xxxx

   Security-critical: FAIL CLOSED on errors.
   Returns { blocked: true/false } — NO reason exposed.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    normalizePhone, supabaseGet, createMemoryRateLimiter,
    checkGlobalRateLimit, logSecurityEvent, TIMEOUT
} from './_lib/security.js';

/* ── Rate limiter: max 10 checks per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 10 });

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Global rate limiting ── */
    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    /* ── Bot detection — FAIL CLOSED ── */
    if (isBot(req)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── Per-endpoint rate limiting — FAIL CLOSED ── */
    if (rateLimiter.check(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    const phone = req.query.phone || null;
    if (!phone) return res.status(200).json({ blocked: false });

    if (typeof phone !== 'string' || phone.length > 20) {
        return res.status(200).json({ blocked: false });
    }

    try {
        const normalizedInput = normalizePhone(phone);
        if (!normalizedInput || normalizedInput.length < 9) {
            return res.status(200).json({ blocked: false });
        }

        const result = await supabaseGet(
            'blocked_phones',
            `normalized_phone=eq.${encodeURIComponent(normalizedInput)}&select=id&limit=1`,
            TIMEOUT.SECURITY
        );
        return res.status(200).json({ blocked: result.length > 0 });

    } catch {
        // FAIL CLOSED — if we can't check, assume blocked
        logSecurityEvent('critical', 'check_phone:db_error', { ip });
        return res.status(200).json({ blocked: true });
    }
}
