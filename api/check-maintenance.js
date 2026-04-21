/* ═══════════════════════════════════════════════════════════════
   DALAL — Check Maintenance Mode (Hardened)
   ─────────────────────────────────────────────────────────────
   GET /api/check-maintenance
   
   Hardened:
   - Strict CORS (no wildcard)
   - No hardcoded keys
   - Rate limiting (prevents cache-busting DoS)
   - Fail-open behavior preserved (site accessibility priority)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, createMemoryRateLimiter,
    SUPABASE_URL, SUPABASE_ANON_KEY
} from './_lib/security.js';

/* ── Rate limiter: max 20 checks per IP per minute ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 60000, maxHits: 20 });

/* ── Extract IP (inline — no import dependency for this simple endpoint) ── */
function getIP(req) {
    return req.headers['x-vercel-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.socket?.remoteAddress
        || null;
}

export default async function handler(req, res) {
    /* ── CORS (strict — no wildcard) ── */
    setCorsHeaders(req, res, 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Rate limiting ── */
    const ip = getIP(req);
    if (rateLimiter.check(ip)) {
        // Rate limited — fail open (don't show maintenance)
        return res.status(200).json({ maintenance: false });
    }

    try {
        const anonKey = SUPABASE_ANON_KEY;
        if (!anonKey) {
            // No key configured — fail open
            return res.status(200).json({ maintenance: false });
        }

        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/site_settings?key=eq.maintenance_mode&select=value`,
            {
                method: 'GET',
                headers: {
                    'apikey': anonKey,
                    'Authorization': `Bearer ${anonKey}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(4000)
            }
        );

        if (!fetchRes.ok) {
            return res.status(200).json({ maintenance: false });
        }

        const data = await fetchRes.json();
        if (!data || data.length === 0) {
            return res.status(200).json({ maintenance: false });
        }

        const val = data[0].value || {};
        return res.status(200).json({
            maintenance: val.enabled === true,
            message: val.message || null
        });

    } catch {
        // Fail open — site accessibility > maintenance accuracy
        return res.status(200).json({ maintenance: false });
    }
}
