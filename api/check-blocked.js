/* ═══════════════════════════════════════════════════════════════
   DALAL — Combined Block Check + Geo (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-blocked?fp=xxx

   PRIVACY: Never returns the user's raw IP address.
   Returns only: { blocked, reason, country, city }

   Security-critical endpoint — FAIL CLOSED on errors.
   If block status cannot be determined, assume blocked.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, supabaseGet, getGeoLocation, createMemoryRateLimiter,
    checkGlobalRateLimit, logSecurityEvent, TIMEOUT
} from './_lib/security.js';

/* ── Rate limiter: max 60 checks per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 60 });

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Extract IP ── */
    const ip = getServerIP(req);

    /* ── Global rate limiting ── */
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    /* ── Bot detection — FAIL CLOSED (block check is security-critical) ── */
    if (isBot(req)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── Per-endpoint rate limiting ── */
    if (rateLimiter.check(ip)) {
        // Rate limited — FAIL CLOSED for security check
        return res.status(429).json({ error: 'Too many requests' });
    }

    if (!ip) {
        // No IP — FAIL CLOSED (cannot determine block status)
        return res.status(403).json({ error: 'Cannot verify client' });
    }

    const fingerprint = req.query.fp ? sanitize(req.query.fp, 64) : null;

    try {
        /* ── Check IP and fingerprint blocks in parallel ── */
        const [ipCheck, fpCheck] = await Promise.all([
            supabaseGet('blocked_ips', `ip=eq.${encodeURIComponent(ip)}&select=ip,reason&limit=1`, TIMEOUT.SECURITY),
            fingerprint
                ? supabaseGet('blocked_fingerprints', `fingerprint=eq.${encodeURIComponent(fingerprint)}&select=fingerprint,reason&limit=1`, TIMEOUT.SECURITY)
                : Promise.resolve([])
        ]);

        /* ── Blocked — return status WITH reason ── */
        if (ipCheck.length > 0 || fpCheck.length > 0) {
            const reason = ipCheck.length > 0
                ? (ipCheck[0].reason || null)
                : (fpCheck[0].reason || null);
            return res.status(200).json({
                blocked: true,
                reason,
                country: null,
                city: null
            });
        }

    } catch {
        // FAIL CLOSED — if we can't check block status, assume blocked
        logSecurityEvent('critical', 'check_blocked:db_error', { ip });
        return res.status(200).json({
            blocked: true,
            reason: 'Unable to verify status. Please try again.',
            country: null,
            city: null
        });
    }

    /* ── Geo-IP lookup (non-critical — fail safe) ── */
    const { country, city } = await getGeoLocation(ip);

    return res.status(200).json({ blocked: false, country, city });
}
