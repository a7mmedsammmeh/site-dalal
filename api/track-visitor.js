/* ═══════════════════════════════════════════════════════════════
   DALAL — Server-Side Visitor Tracking (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/track-visitor

   Non-critical analytics endpoint — fail SAFE on errors.
   Silently accepts bots/rate-limited requests without inserting.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitizeOrNull, supabaseInsertMinimal, getGeoLocation,
    createMemoryRateLimiter, checkGlobalRateLimit, getCompositeId
} from './_lib/security.js';

/* ── In-memory rate limiter ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 300000, maxHits: 10 });

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    const ip = getServerIP(req);

    /* ── Global rate limiting ── */
    if (checkGlobalRateLimit(ip)) {
        return res.status(200).json({ ok: true }); // non-critical — silent
    }

    /* ── Bot detection — silently accept but don't insert ── */
    if (isBot(req)) {
        return res.status(200).json({ ok: true });
    }

    /* ── Per-endpoint rate limiting ── */
    if (ip && rateLimiter.check(ip)) {
        return res.status(200).json({ ok: true });
    }

    try {
        const body = req.body || {};

        /* ── Geo-IP (non-critical — fail safe) ── */
        const { country, city } = await getGeoLocation(ip);

        /* ── Composite ID for dedup ── */
        const compositeId = getCompositeId(ip, req, body.fingerprint);

        const visitor = {
            ip:           ip,
            country:      country,
            city:         city,
            fingerprint:  sanitizeOrNull(body.fingerprint, 64),
            composite_id: compositeId,
            device_type:  sanitizeOrNull(body.device_type, 10),
            os:           sanitizeOrNull(body.os, 20),
            browser:      sanitizeOrNull(body.browser, 20),
            screen_res:   sanitizeOrNull(body.screen_res, 20),
            lang:         sanitizeOrNull(body.lang, 10),
            timezone:     sanitizeOrNull(body.timezone, 50),
            page:         sanitizeOrNull(body.page, 500),
            referrer:     sanitizeOrNull(body.referrer, 500),
            visited_at:   new Date().toISOString()
        };

        await supabaseInsertMinimal('visitors', visitor);
        return res.status(200).json({ ok: true });

    } catch {
        // Non-critical — fail safe, never expose errors
        return res.status(200).json({ ok: true });
    }
}
