/* ═══════════════════════════════════════════════════════════════
   DALAL — Server-Side Visitor Tracking
   ─────────────────────────────────────────────────────────────
   POST /api/track-visitor
   
   • Extracts real IP from request headers (NOT from client)
   • Validates request origin (allowlist only)
   • Rate-limits per IP (max 10 per 5 minutes)
   • Basic bot detection (user-agent checks)
   • Inserts into Supabase using service key (server-side only)
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

/* ── Trusted origins allowlist ── */
const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

/* ── In-memory rate limiter (per serverless invocation lifetime) ── */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 5 * 60 * 1000;   // 5 minutes
const MAX_PER_IP     = 10;               // max 10 visits per IP per window

function isRateLimited(ip) {
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    // Reset window if expired
    if (now - record.windowStart > RATE_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    record.count++;
    return record.count > MAX_PER_IP;
}

/* ── Bot detection (basic) ── */
const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i
];

function isBot(userAgent) {
    if (!userAgent) return true;      // No UA = suspicious
    if (userAgent.length < 10) return true; // Too short = suspicious
    return BOT_PATTERNS.some(p => p.test(userAgent));
}

/* ── Supabase insert ── */
async function supabaseInsert(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase insert failed: ${err}`);
    }
}

/* ── Extract real IP from request ── */
function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || null;
}

/* ── Sanitize & limit string length ── */
function sanitize(val, maxLen = 200) {
    if (typeof val !== 'string') return null;
    return val.substring(0, maxLen).trim() || null;
}

export default async function handler(req, res) {
    /* ── CORS — dynamic origin from allowlist ── */
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Validate origin ── */
    /* Same-origin POST requests may not include Origin header,
       so we only REJECT when Origin IS present and NOT in allowlist.
       Also check Referer as fallback for extra safety. */
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        const referer = req.headers.referer || req.headers.referrer || '';
        const refererAllowed = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
        if (!refererAllowed) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    /* ── Extract real IP from server headers ── */
    const ip = getIP(req);

    /* ── Bot detection ── */
    const userAgent = req.headers['user-agent'] || '';
    if (isBot(userAgent)) {
        // Silently accept but don't insert — don't reveal detection
        return res.status(200).json({ ok: true });
    }

    /* ── Rate limiting ── */
    if (ip && isRateLimited(ip)) {
        // Silently accept but don't insert — don't reveal rate limiting
        return res.status(200).json({ ok: true });
    }

    try {
        const body = req.body || {};

        /* ── Fetch geolocation server-side ── */
        let country = null, city = null;
        if (ip) {
            try {
                const geoRes = await fetch(
                    `http://ip-api.com/json/${ip}?fields=status,country,city`,
                    { signal: AbortSignal.timeout(3000) }
                );
                if (geoRes.ok) {
                    const g = await geoRes.json();
                    if (g.status === 'success') {
                        country = g.country || null;
                        city    = g.city    || null;
                    }
                }
            } catch { /* silent — geo is optional */ }
        }

        /* ── Build visitor record from SERVER-DERIVED + sanitised client data ── */
        const visitor = {
            ip:          ip,                                    // FROM SERVER HEADERS
            country:     country,                               // FROM SERVER GEO LOOKUP
            city:        city,                                  // FROM SERVER GEO LOOKUP
            fingerprint: sanitize(body.fingerprint, 64),        // client-provided but limited
            device_type: sanitize(body.device_type, 10),
            os:          sanitize(body.os, 20),
            browser:     sanitize(body.browser, 20),
            screen_res:  sanitize(body.screen_res, 20),
            lang:        sanitize(body.lang, 10),
            timezone:    sanitize(body.timezone, 50),
            page:        sanitize(body.page, 500),
            referrer:    sanitize(body.referrer, 500),
            visited_at:  new Date().toISOString()               // SERVER TIMESTAMP
        };

        await supabaseInsert('visitors', visitor);

        return res.status(200).json({ ok: true });

    } catch (err) {
        console.error('track-visitor error:', err);
        // Don't expose internal errors — return success to avoid revealing info
        return res.status(200).json({ ok: true });
    }
}
