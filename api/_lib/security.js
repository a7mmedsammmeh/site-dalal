/* ═══════════════════════════════════════════════════════════════
   DALAL — Shared Security Utilities
   ─────────────────────────────────────────────────────────────
   Centralized security primitives used by all API endpoints.
   Import once, use everywhere — no duplication.
   ═══════════════════════════════════════════════════════════════ */

/* ── Environment (fail-fast if missing) ── */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const KV_REST_API_URL = process.env.KV_REST_API_URL || null;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || null;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    throw new Error(
        'FATAL: Missing required environment variables. ' +
        'Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_ANON_KEY.'
    );
}

const SERVICE_HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
};

/* ═══════════════════════════════════════════════════════════════
   CORS & ORIGIN VALIDATION
   ═══════════════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

/**
 * Sets CORS headers using strict origin allowlist.
 * Never uses wildcard (*).
 */
function setCorsHeaders(req, res, methods = 'POST, OPTIONS') {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/**
 * Validates both Origin and Referer headers against allowlist.
 * Returns true if at least one is valid.
 */
function validateOrigin(req) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || req.headers.referrer || '';
    const isValidOrigin = ALLOWED_ORIGINS.includes(origin);
    const isValidReferer = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
    return isValidOrigin || isValidReferer;
}

/* ═══════════════════════════════════════════════════════════════
   IP EXTRACTION (Trusted Headers Only)
   ─────────────────────────────────────────────────────────────
   Priority order:
   1. x-vercel-forwarded-for (set by Vercel — CANNOT be spoofed)
   2. x-real-ip (set by infrastructure)
   3. x-forwarded-for (LAST — can be spoofed by clients)
   4. socket remoteAddress (direct connection)
   ═══════════════════════════════════════════════════════════════ */

function getServerIP(req) {
    // Vercel sets this — most trusted
    const vercelIP = req.headers['x-vercel-forwarded-for'];
    if (vercelIP) return vercelIP.split(',')[0].trim();

    // Infrastructure proxy header
    const realIP = req.headers['x-real-ip'];
    if (realIP) return realIP.trim();

    // Least trusted — only use as last resort
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();

    return req.socket?.remoteAddress || null;
}

/* ═══════════════════════════════════════════════════════════════
   RATE LIMITING
   ─────────────────────────────────────────────────────────────
   Hybrid approach:
   1. Vercel KV (Redis) — primary, cross-instance
   2. Supabase DB — fallback if KV not configured
   3. In-memory Map — fast first-line defense (per instance)
   ═══════════════════════════════════════════════════════════════ */

/**
 * Creates an in-memory rate limiter with max-size eviction.
 * Prevents memory DoS by capping Map size.
 */
function createMemoryRateLimiter({ maxEntries = 1000, windowMs = 600000, maxHits = 3 } = {}) {
    const map = new Map();

    function cleanup() {
        const now = Date.now();
        for (const [key, record] of map) {
            if (now - record.windowStart > windowMs) map.delete(key);
        }
    }

    function evictOldest() {
        if (map.size <= maxEntries) return;
        // Delete oldest entries (first inserted)
        const excess = map.size - maxEntries;
        let deleted = 0;
        for (const key of map.keys()) {
            if (deleted >= excess) break;
            map.delete(key);
            deleted++;
        }
    }

    return {
        check(key) {
            if (!key) return false;
            const now = Date.now();

            // Periodic cleanup
            if (map.size > maxEntries * 0.8) {
                cleanup();
                evictOldest();
            }

            const record = map.get(key);
            if (!record || now - record.windowStart > windowMs) {
                map.set(key, { count: 1, windowStart: now });
                return false; // not limited
            }

            record.count++;
            return record.count > maxHits; // true = rate limited
        },

        updateConfig(newWindowMs, newMaxHits) {
            if (newWindowMs) windowMs = newWindowMs;
            if (newMaxHits) maxHits = newMaxHits;
        },

        get size() { return map.size; }
    };
}

/**
 * Vercel KV rate limiter (Redis-backed, cross-instance).
 * Falls back to Supabase DB if KV is not configured.
 */
async function kvRateLimit(key, windowMs, maxHits) {
    if (!KV_REST_API_URL || !KV_REST_API_TOKEN) return null; // KV not configured

    try {
        const kvKey = `rl:${key}`;
        const windowSec = Math.ceil(windowMs / 1000);

        // INCR + EXPIRE pattern
        const incrRes = await fetch(`${KV_REST_API_URL}/pipeline`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${KV_REST_API_TOKEN}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([
                ['INCR', kvKey],
                ['EXPIRE', kvKey, windowSec, 'NX']
            ]),
            signal: AbortSignal.timeout(2000)
        });

        if (!incrRes.ok) return null;

        const results = await incrRes.json();
        const count = results?.[0]?.result || 0;
        return count > maxHits;
    } catch {
        return null; // KV error — fall through to other methods
    }
}

/**
 * DB-backed rate limiting — counts recent records by field.
 */
async function dbRateLimit(table, filterField, filterValue, windowMs) {
    try {
        const windowTime = new Date(Date.now() - windowMs).toISOString();
        const data = await supabaseGet(
            table,
            `${filterField}=eq.${encodeURIComponent(filterValue)}&created_at=gte.${windowTime}&select=id`
        );
        return data.length;
    } catch {
        return 0;
    }
}

/* ═══════════════════════════════════════════════════════════════
   BOT DETECTION
   ─────────────────────────────────────────────────────────────
   Multi-signal approach:
   1. User-Agent pattern matching (secondary — easily spoofed)
   2. Header integrity checks (harder to fake)
   3. Behavioral signals (accept headers, etc.)
   ═══════════════════════════════════════════════════════════════ */

const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /httpie/i, /insomnia/i, /go-http/i, /java\//i, /libwww/i,
    /scrapy/i, /mechanize/i, /httpclient/i
];

function isBot(req) {
    const ua = req.headers['user-agent'] || '';

    // No User-Agent at all
    if (!ua) return true;

    // Suspiciously short UA
    if (ua.length < 20) return true;

    // Known bot patterns
    if (BOT_PATTERNS.some(p => p.test(ua))) return true;

    // Missing typical browser headers (harder to fake)
    const accept = req.headers['accept'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';

    // Real browsers always send these — scripts often don't
    if (!accept && !acceptLang && !acceptEnc) return true;

    return false;
}

/* ═══════════════════════════════════════════════════════════════
   INPUT SANITIZATION
   ═══════════════════════════════════════════════════════════════ */

function sanitize(val, maxLen = 200) {
    if (typeof val !== 'string') return '';
    return val
        .replace(/<[^>]*>/g, '')       // strip HTML tags
        .replace(/[<>]/g, '')          // strip remaining angle brackets
        .replace(/\s+/g, ' ')          // normalize whitespace
        .trim()
        .slice(0, maxLen);
}

function sanitizeOrNull(val, maxLen = 200) {
    if (val == null || typeof val !== 'string') return null;
    const cleaned = sanitize(val, maxLen);
    return cleaned || null;
}

/* ═══════════════════════════════════════════════════════════════
   PHONE NORMALIZATION
   ─────────────────────────────────────────────────────────────
   Strips country codes & leading zeros so blocking works for
   ALL formats of Egyptian phone numbers:
   01221808060 / +201221808060 / 201221808060 / 00201221808060
   → 1221808060
   ═══════════════════════════════════════════════════════════════ */

function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0020') && cleaned.length >= 14) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('20') && cleaned.length >= 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length >= 11) cleaned = cleaned.slice(1);
    return cleaned;
}

/* ═══════════════════════════════════════════════════════════════
   HASHING (SHA-256)
   ─────────────────────────────────────────────────────────────
   Replaces weak DJB2 hash with cryptographic SHA-256.
   Used for duplicate payload detection and log sanitization.
   ═══════════════════════════════════════════════════════════════ */

async function hashSHA256(str) {
    try {
        const { createHash } = await import('crypto');
        return createHash('sha256').update(str).digest('hex');
    } catch {
        // Fallback for environments without crypto
        const encoder = new TextEncoder();
        const data = encoder.encode(str);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}

/**
 * Hash sensitive data for safe logging.
 * Returns first 8 chars of SHA-256 — enough for correlation, not for reversal.
 */
async function hashForLog(value) {
    if (!value) return 'none';
    const hash = await hashSHA256(String(value));
    return hash.slice(0, 8);
}

/* ═══════════════════════════════════════════════════════════════
   GEO-IP CACHING
   ─────────────────────────────────────────────────────────────
   In-memory cache for ip-api.com results.
   TTL: 1 hour. Max entries: 500.
   Prevents hitting ip-api free tier limit (45 req/min).
   ═══════════════════════════════════════════════════════════════ */

const geoCache = new Map();
const GEO_CACHE_TTL = 60 * 60 * 1000; // 1 hour
const GEO_CACHE_MAX = 500;

async function getGeoLocation(ip) {
    if (!ip) return { country: null, city: null };

    // Check cache first
    const cached = geoCache.get(ip);
    if (cached && Date.now() < cached.expiresAt) {
        return { country: cached.country, city: cached.city };
    }

    // Evict if too large
    if (geoCache.size >= GEO_CACHE_MAX) {
        const now = Date.now();
        for (const [key, val] of geoCache) {
            if (now >= val.expiresAt) geoCache.delete(key);
        }
        // If still too large, delete oldest
        if (geoCache.size >= GEO_CACHE_MAX) {
            const firstKey = geoCache.keys().next().value;
            if (firstKey) geoCache.delete(firstKey);
        }
    }

    try {
        const geoRes = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,city`,
            { signal: AbortSignal.timeout(3000) }
        );
        if (geoRes.ok) {
            const g = await geoRes.json();
            if (g.status === 'success') {
                const result = { country: g.country || null, city: g.city || null };
                geoCache.set(ip, { ...result, expiresAt: Date.now() + GEO_CACHE_TTL });
                return result;
            }
        }
    } catch { /* geo is optional */ }

    return { country: null, city: null };
}

/* ═══════════════════════════════════════════════════════════════
   SUPABASE HELPERS
   ═══════════════════════════════════════════════════════════════ */

async function supabaseGet(table, filter) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
        { headers: SERVICE_HEADERS, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    return await res.json();
}

async function supabaseInsert(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...SERVICE_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase insert failed: ${err}`);
    }
    return await res.json();
}

async function supabaseInsertMinimal(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...SERVICE_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(5000)
    });
    return res.ok;
}

async function supabasePatch(table, filter, body) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
        {
            method: 'PATCH',
            headers: { ...SERVICE_HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(5000)
        }
    );
    return res.ok;
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY EVENT LOGGING
   ─────────────────────────────────────────────────────────────
   Logs security events WITHOUT sensitive data.
   IP and phone are hashed before logging.
   Dedup: identical events within 60s are suppressed.
   ═══════════════════════════════════════════════════════════════ */

const _logDedup = new Map();
const _LOG_DEDUP_WINDOW = 60000; // 60 seconds
const _LOG_DEDUP_MAX = 500;

async function logSecurityEvent(type, metadata = {}) {
    try {
        // Hash sensitive fields before logging
        const safeIP = metadata.ip ? await hashForLog(metadata.ip) : 'none';
        const safePhone = metadata.phone ? await hashForLog(metadata.phone) : null;

        // Dedup: skip identical events within window
        const dedupKey = `${type}:${safeIP}`;
        const now = Date.now();
        if (_logDedup.has(dedupKey) && now - _logDedup.get(dedupKey) < _LOG_DEDUP_WINDOW) {
            return; // suppress duplicate
        }
        _logDedup.set(dedupKey, now);

        // Evict old dedup entries
        if (_logDedup.size > _LOG_DEDUP_MAX) {
            for (const [k, ts] of _logDedup) {
                if (now - ts > _LOG_DEDUP_WINDOW) _logDedup.delete(k);
            }
            if (_logDedup.size > _LOG_DEDUP_MAX) {
                const firstKey = _logDedup.keys().next().value;
                if (firstKey) _logDedup.delete(firstKey);
            }
        }

        const description = [
            `[${type}]`,
            `ip_hash:${safeIP}`,
            safePhone ? `phone_hash:${safePhone}` : null,
            metadata.detail || null,
        ].filter(Boolean).join(' | ');

        await supabaseInsertMinimal('activity_logs', {
            action_type: 'block',
            action_description: description,
            entity_type: 'security',
            entity_id: safeIP
        });
    } catch { /* logging must never break the flow */ }
}

/* ═══════════════════════════════════════════════════════════════
   ADMIN VERIFICATION
   ─────────────────────────────────────────────────────────────
   Verifies admin status via the is_admin() RPC.
   Uses the user's JWT token — RPC is SECURITY DEFINER.
   ═══════════════════════════════════════════════════════════════ */

async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, status: 401, error: 'Unauthorized' };
    }

    const token = authHeader.slice(7); // 'Bearer '.length = 7

    // Reject obviously invalid tokens
    if (!token || token.length < 20) {
        return { valid: false, status: 401, error: 'Unauthorized' };
    }

    try {
        const anonKey = SUPABASE_ANON_KEY;
        if (!anonKey) {
            return { valid: false, status: 500, error: 'Server configuration error' };
        }

        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
            method: 'POST',
            headers: {
                'apikey': anonKey,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!rpcRes.ok) {
            return { valid: false, status: 403, error: 'Forbidden — admin only' };
        }

        const isAdmin = await rpcRes.json();
        if (!isAdmin) {
            return { valid: false, status: 403, error: 'Forbidden — admin only' };
        }

        return { valid: true, token };
    } catch {
        return { valid: false, status: 500, error: 'Admin verification failed' };
    }
}

/* ═══════════════════════════════════════════════════════════════
   FETCH DYNAMIC SECURITY LIMITS
   ═══════════════════════════════════════════════════════════════ */

const DEFAULT_LIMITS = {
    order_max_per_ip: 3,
    order_window_time: 10,
    order_window_unit: 'minutes',
    phone_cooldown_time: 2,
    phone_cooldown_unit: 'minutes',
    duplicate_window_time: 2,
    duplicate_window_unit: 'minutes',
    max_items_per_order: 20,
    review_window_time: 24,
    review_window_unit: 'hours',
    review_max_per_ip: 10
};

const TIME_MULTIPLIERS = {
    minutes: 60 * 1000,
    hours: 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
    weeks: 7 * 24 * 60 * 60 * 1000
};

async function fetchSecurityLimits() {
    let limits = { ...DEFAULT_LIMITS };
    try {
        const data = await supabaseGet(
            'site_settings',
            'key=eq.security_limits&select=value'
        );
        if (data && data.length > 0) {
            limits = { ...limits, ...(data[0].value || {}) };
        }
    } catch { /* proceed with defaults */ }
    return limits;
}

function getWindowMs(limits, timeKey, unitKey, fallbackMin = 10) {
    const t = limits[timeKey] ?? fallbackMin;
    const u = limits[unitKey] ?? 'minutes';
    return t * (TIME_MULTIPLIERS[u] || TIME_MULTIPLIERS.minutes);
}

/* ═══════════════════════════════════════════════════════════════
   GENERATE ORDER REFERENCE
   ═══════════════════════════════════════════════════════════════ */

function generateOrderRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const len = 12;
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let ref = '';
    for (let i = 0; i < len; i++) ref += chars[arr[i] % chars.length];
    return `DL-${ref}`;
}

/* ═══════════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════════ */

export {
    // Environment
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
    SUPABASE_ANON_KEY,
    SERVICE_HEADERS,
    ALLOWED_ORIGINS,

    // CORS & Origin
    setCorsHeaders,
    validateOrigin,

    // IP
    getServerIP,

    // Rate Limiting
    createMemoryRateLimiter,
    kvRateLimit,
    dbRateLimit,

    // Bot Detection
    isBot,

    // Sanitization
    sanitize,
    sanitizeOrNull,

    // Phone
    normalizePhone,

    // Hashing
    hashSHA256,
    hashForLog,

    // Geo-IP
    getGeoLocation,

    // Supabase
    supabaseGet,
    supabaseInsert,
    supabaseInsertMinimal,
    supabasePatch,

    // Logging
    logSecurityEvent,

    // Admin
    verifyAdmin,

    // Security Limits
    DEFAULT_LIMITS,
    TIME_MULTIPLIERS,
    fetchSecurityLimits,
    getWindowMs,

    // Order Ref
    generateOrderRef
};
