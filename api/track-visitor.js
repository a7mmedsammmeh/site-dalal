/* ═══════════════════════════════════════════════════════════════
   DALAL — Server-Side Visitor Tracking (Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/track-visitor
   
   Hardened:
   - Rate limiter with max-size cap and eviction
   - Geo-IP caching (prevents ip-api.com exhaustion)
   - Uses shared security utilities
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitizeOrNull, supabaseInsertMinimal, getGeoLocation,
    createMemoryRateLimiter
} from './_lib/security.js';

/* ── In-memory rate limiter with proper max-size ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 300000, maxHits: 10 });

export default async function handler(req, res) {
    /* ── CORS ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Extract real IP from server headers ── */
    const ip = getServerIP(req);

    /* ── Bot detection — silently accept but don't insert ── */
    if (isBot(req)) {
        return res.status(200).json({ ok: true });
    }

    /* ── Rate limiting — silently accept but don't insert ── */
    if (ip && rateLimiter.check(ip)) {
        return res.status(200).json({ ok: true });
    }

    try {
        const body = req.body || {};

        /* ── Geo-IP (CACHED — prevents ip-api.com exhaustion) ── */
        const { country, city } = await getGeoLocation(ip);

        /* ── Build visitor record from SERVER-DERIVED + sanitized client data ── */
        const visitor = {
            ip:          ip,
            country:     country,
            city:        city,
            fingerprint: sanitizeOrNull(body.fingerprint, 64),
            device_type: sanitizeOrNull(body.device_type, 10),
            os:          sanitizeOrNull(body.os, 20),
            browser:     sanitizeOrNull(body.browser, 20),
            screen_res:  sanitizeOrNull(body.screen_res, 20),
            lang:        sanitizeOrNull(body.lang, 10),
            timezone:    sanitizeOrNull(body.timezone, 50),
            page:        sanitizeOrNull(body.page, 500),
            referrer:    sanitizeOrNull(body.referrer, 500),
            visited_at:  new Date().toISOString()
        };

        await supabaseInsertMinimal('visitors', visitor);
        return res.status(200).json({ ok: true });

    } catch {
        // Don't expose internal errors — return success to avoid revealing info
        return res.status(200).json({ ok: true });
    }
}
