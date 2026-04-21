/* ═══════════════════════════════════════════════════════════════
   DALAL — Public Config Endpoint (v4 — Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/config

   Returns public Supabase config (URL + anon key).
   The service_role key is NEVER returned.
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, getServerIP, createMemoryRateLimiter,
    checkGlobalRateLimit, SUPABASE_URL, SUPABASE_ANON_KEY
} from './_lib/security.js';

/* ── Rate limiter: max 30 requests per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 30 });

export default function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Global + per-endpoint rate limiting ── */
    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }
    if (rateLimiter.check(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
        url: SUPABASE_URL,
        key: SUPABASE_ANON_KEY
    });
}
