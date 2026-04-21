/* ═══════════════════════════════════════════════════════════════
   DALAL — Combined Block Check + Geo (Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-blocked?fp=xxx
   
   Replaces /api/get-ip entirely.
   
   PRIVACY: Never returns the user's raw IP address.
   Returns only: { blocked, country, city }
   
   Checks:
   1. IP block (from server headers — NOT client)
   2. Fingerprint block (optional, via ?fp= query param)
   3. Geo-IP lookup (cached)
   
   Rate limited + bot detection.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, supabaseGet, getGeoLocation, createMemoryRateLimiter
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

    /* ── Extract IP from SERVER headers (never from client) ── */
    const ip = getServerIP(req);

    /* ── Bot detection — consistent response ── */
    if (isBot(req)) {
        return res.status(200).json({ blocked: false, country: null, city: null });
    }

    /* ── Rate limiting ── */
    if (rateLimiter.check(ip)) {
        return res.status(200).json({ blocked: false, country: null, city: null });
    }

    if (!ip) {
        return res.status(200).json({ blocked: false, country: null, city: null });
    }

    const fingerprint = req.query.fp ? sanitize(req.query.fp, 64) : null;

    try {
        /* ── Check IP and fingerprint blocks in parallel ── */
        const [ipCheck, fpCheck] = await Promise.all([
            supabaseGet('blocked_ips', `ip=eq.${encodeURIComponent(ip)}&select=ip&limit=1`),
            fingerprint
                ? supabaseGet('blocked_fingerprints', `fingerprint=eq.${encodeURIComponent(fingerprint)}&select=fingerprint&limit=1`)
                : Promise.resolve([])
        ]);

        /* ── Blocked — return status WITHOUT reason ── */
        if (ipCheck.length > 0 || fpCheck.length > 0) {
            return res.status(200).json({
                blocked: true,
                country: null,
                city: null
            });
        }

    } catch {
        // On error checking blocks, fail safe — don't block legitimate users
    }

    /* ── Geo-IP lookup (cached — prevents ip-api.com exhaustion) ── */
    const { country, city } = await getGeoLocation(ip);

    /* ── Response: NEVER include raw IP ── */
    return res.status(200).json({ blocked: false, country, city });
}
