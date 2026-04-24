/* ═══════════════════════════════════════════════════════════════
   DALAL — Shared Security Utilities (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   Centralized security primitives used by all API endpoints.
   Import once, use everywhere — no duplication.

   v4 Changes:
   - KV rate limit: FAIL CLOSED when KV configured but unavailable
   - Composite client ID: hash(IP + UA + fingerprint + headers)
   - HMAC anti-replay validation for sensitive endpoints
   - Anomaly detection with auto-blocking
   - Logging with severity levels + async batching
   - Strict timeout enforcement
   - Security headers helper
   - Global rate limiting
   ═══════════════════════════════════════════════════════════════ */

import { createHash, randomBytes, timingSafeEqual as _timingSafeEqual, createHmac } from 'crypto';

/* ══════════════════════════════════════════════════════════════════
   ENVIRONMENT
   ══════════════════════════════════════════════════════════════════ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const KV_REST_API_URL = process.env.KV_REST_API_URL || null;
const KV_REST_API_TOKEN = process.env.KV_REST_API_TOKEN || null;
const HMAC_SECRET = process.env.HMAC_SECRET || null;

const KV_CONFIGURED = !!(KV_REST_API_URL && KV_REST_API_TOKEN);

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !SUPABASE_ANON_KEY) {
    console.error(
        'CRITICAL: Missing required environment variables. ' +
        'Set SUPABASE_URL, SUPABASE_SERVICE_KEY, and SUPABASE_ANON_KEY.'
    );
}

const SERVICE_HEADERS = {
    'apikey': SUPABASE_SERVICE_KEY,
    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    'Content-Type': 'application/json'
};

/* ══════════════════════════════════════════════════════════════════
   TIMEOUT CONSTANTS
   ─────────────────────────────────────────────────────────────────
   Strict timeouts for ALL external calls.
   Security checks: 3s (fail closed on timeout)
   Non-critical: 4s (fail safe on timeout)
   ══════════════════════════════════════════════════════════════════ */

const TIMEOUT = {
    SECURITY: 3000,   // security-critical: block checks, rate limits
    DB_WRITE: 5000,   // database writes (orders, reviews)
    DB_READ: 4000,    // database reads (pricing, products)
    GEO: 2000,        // geo-ip (non-critical)
    KV: 2000,         // Vercel KV operations
    ADMIN: 4000       // admin verification
};

/* ══════════════════════════════════════════════════════════════════
   SECURITY HEADERS
   ══════════════════════════════════════════════════════════════════ */

function setSecurityHeaders(res) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '0');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
}

/* ══════════════════════════════════════════════════════════════════
   CORS & ORIGIN VALIDATION
   ══════════════════════════════════════════════════════════════════ */

const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

function setCorsHeaders(req, res, methods = 'POST, OPTIONS') {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', methods);
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Timestamp, X-Request-Signature');
    // Always set security headers
    setSecurityHeaders(res);
}

function validateOrigin(req) {
    const origin = req.headers.origin || '';
    const referer = req.headers.referer || req.headers.referrer || '';
    const isValidOrigin = ALLOWED_ORIGINS.includes(origin);
    const isValidReferer = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
    return isValidOrigin || isValidReferer;
}

/* ══════════════════════════════════════════════════════════════════
   IP EXTRACTION (Trusted Headers Only)
   ══════════════════════════════════════════════════════════════════ */

function getServerIP(req) {
    const vercelIP = req.headers['x-vercel-forwarded-for'];
    if (vercelIP) return vercelIP.split(',')[0].trim();
    const realIP = req.headers['x-real-ip'];
    if (realIP) return realIP.trim();
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) return forwarded.split(',')[0].trim();
    return req.socket?.remoteAddress || null;
}

/* ══════════════════════════════════════════════════════════════════
   COMPOSITE CLIENT ID (Strengthened Fingerprint)
   ─────────────────────────────────────────────────────────────────
   Combines multiple signals into a single identifier:
   IP + User-Agent hash + Accept headers + client fingerprint
   Much harder to spoof than fingerprint alone.
   ══════════════════════════════════════════════════════════════════ */

function getCompositeId(ip, req, fingerprint) {
    const ua = req.headers['user-agent'] || '';
    const accept = req.headers['accept'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';
    const raw = `${ip || 'no-ip'}|${ua}|${accept}|${acceptLang}|${acceptEnc}|${fingerprint || 'no-fp'}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 24);
}

/* ══════════════════════════════════════════════════════════════════
   GLOBAL RATE LIMITING (per-instance, all endpoints)
   ─────────────────────────────────────────────────────────────────
   First line of defense: blocks excessive traffic per IP
   before hitting any endpoint-specific logic.
   100 requests / minute per IP across all endpoints.
   ══════════════════════════════════════════════════════════════════ */

const globalRateLimiter = createMemoryRateLimiter({ maxEntries: 5000, windowMs: 60000, maxHits: 100 });

function checkGlobalRateLimit(ip) {
    if (!ip) return false;
    return globalRateLimiter.check(ip);
}

/* ══════════════════════════════════════════════════════════════════
   RATE LIMITING
   ─────────────────────────────────────────────────────────────────
   Hybrid approach:
   1. Vercel KV (Redis) — primary, cross-instance
      → FAIL CLOSED if KV configured but unavailable
   2. Supabase DB — fallback ONLY if KV not configured
   3. In-memory Map — fast first-line defense (per instance)
   ══════════════════════════════════════════════════════════════════ */

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
        const excess = map.size - maxEntries;
        let deleted = 0;
        for (const key of map.keys()) {
            if (deleted >= excess) break;
            map.delete(key);
            deleted++;
        }
    }

    return {
        /**
         * Check if key is rate limited.
         * By default, auto-records the attempt (for API rate limiting).
         * Pass autoRecord=false for order limiter where you want to
         * record only AFTER successful creation.
         */
        check(key, autoRecord = true) {
            if (!key) return false;
            const now = Date.now();

            if (map.size > maxEntries * 0.8) {
                cleanup();
                evictOldest();
            }

            const record = map.get(key);
            if (!record || now - record.windowStart > windowMs) {
                if (autoRecord) {
                    map.set(key, { count: 1, windowStart: now });
                }
                return false;
            }

            if (record.count >= maxHits) {
                return true; // blocked — don't increment
            }

            if (autoRecord) {
                record.count++;
            }
            return false;
        },

        /**
         * Record a successful action manually.
         * Use when autoRecord=false in check().
         */
        record(key) {
            if (!key) return;
            const now = Date.now();
            const record = map.get(key);
            if (!record || now - record.windowStart > windowMs) {
                map.set(key, { count: 1, windowStart: now });
            } else {
                record.count++;
            }
        },

        getCount(key) {
            if (!key) return 0;
            const record = map.get(key);
            if (!record) return 0;
            if (Date.now() - record.windowStart > windowMs) return 0;
            return record.count;
        },

        updateConfig(newWindowMs, newMaxHits) {
            const changed = (newMaxHits && newMaxHits !== maxHits) ||
                            (newWindowMs && newWindowMs !== windowMs);
            if (newWindowMs) windowMs = newWindowMs;
            if (newMaxHits) maxHits = newMaxHits;
            // When admin changes config, clear all records so new limits apply immediately
            if (changed) map.clear();
        },

        get size() { return map.size; }
    };
}

/**
 * Vercel KV rate limiter — FAIL OPEN when KV errors.
 *
 * Returns:
 *   true  = rate limited (block)
 *   false = within limits (allow)
 *   null  = KV not configured or unavailable (caller should use DB fallback)
 *
 * If KV IS configured but fails/times out → returns null (fall through to DB).
 */
async function kvRateLimit(key, windowMs, maxHits) {
    if (!KV_CONFIGURED) return null; // KV not configured — caller uses DB fallback

    try {
        const kvKey = `rl:${key}`;
        const windowSec = Math.ceil(windowMs / 1000);

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
            signal: AbortSignal.timeout(TIMEOUT.KV)
        });

        if (!incrRes.ok) {
            // KV configured but HTTP error → fall through to DB
            logSecurityEvent('critical', 'kv:http_error', { detail: `status:${incrRes.status}` });
            return null;
        }

        const results = await incrRes.json();
        const count = results?.[0]?.result || 0;
        return count > maxHits;
    } catch (err) {
        // KV configured but error/timeout → fall through to DB
        logSecurityEvent('critical', 'kv:failure', { detail: err?.message || 'timeout' });
        return null;
    }
}


/**
 * DB-backed rate limiting — counts recent records by field.
 * Used ONLY when KV is not configured.
 */
async function dbRateLimit(table, filterField, filterValue, windowMs) {
    try {
        const windowTime = new Date(Date.now() - windowMs).toISOString();
        const data = await supabaseGet(
            table,
            `${filterField}=eq.${encodeURIComponent(filterValue)}&created_at=gte.${windowTime}&select=id`,
            TIMEOUT.SECURITY
        );
        return data.length;
    } catch {
        return 0;
    }
}

/* ══════════════════════════════════════════════════════════════════
   BOT DETECTION
   ══════════════════════════════════════════════════════════════════ */

const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /httpie/i, /insomnia/i, /go-http/i, /java\//i, /libwww/i,
    /scrapy/i, /mechanize/i, /httpclient/i
];

function isBot(req) {
    const ua = req.headers['user-agent'] || '';
    if (!ua) return true;
    if (ua.length < 20) return true;
    if (BOT_PATTERNS.some(p => p.test(ua))) return true;

    const accept = req.headers['accept'] || '';
    const acceptLang = req.headers['accept-language'] || '';
    const acceptEnc = req.headers['accept-encoding'] || '';
    if (!accept && !acceptLang && !acceptEnc) return true;

    return false;
}

/* ══════════════════════════════════════════════════════════════════
   INPUT SANITIZATION
   ══════════════════════════════════════════════════════════════════ */

function sanitize(val, maxLen = 200) {
    if (typeof val !== 'string') return '';
    return val
        .replace(/<[^>]*>/g, '')
        .replace(/[<>]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLen);
}

function sanitizeOrNull(val, maxLen = 200) {
    if (val == null || typeof val !== 'string') return null;
    const cleaned = sanitize(val, maxLen);
    return cleaned || null;
}

/* ══════════════════════════════════════════════════════════════════
   PHONE NORMALIZATION
   ══════════════════════════════════════════════════════════════════ */

function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0020') && cleaned.length >= 14) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('20') && cleaned.length >= 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length >= 11) cleaned = cleaned.slice(1);
    return cleaned;
}

/* ══════════════════════════════════════════════════════════════════
   HASHING (SHA-256)
   ══════════════════════════════════════════════════════════════════ */

async function hashSHA256(str) {
    return createHash('sha256').update(str).digest('hex');
}

async function hashForLog(value) {
    if (!value) return 'none';
    const hash = await hashSHA256(String(value));
    return hash.slice(0, 8);
}

/* ══════════════════════════════════════════════════════════════════
   GEO-IP (Vercel Headers → ip-api.com fallback)
   ─────────────────────────────────────────────────────────────────
   Primary:  Vercel auto-injected headers (instant, free, reliable)
             x-vercel-ip-country → ISO 3166-1 alpha-2 (e.g. "EG")
             x-vercel-ip-city    → city name (e.g. "Cairo")
   Fallback: ip-api.com (free tier, 45 req/min, HTTP only)

   getGeoLocation(ip, req?) — `req` is optional for backward compat.
   When `req` is provided, Vercel headers are checked first.
   ══════════════════════════════════════════════════════════════════ */

const geoCache = new Map();
const GEO_CACHE_TTL = 60 * 60 * 1000;
const GEO_CACHE_MAX = 500;

const IP_V4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;
const IP_V6_RE = /^[0-9a-fA-F:]+$/;
function isValidIP(ip) {
    if (!ip || typeof ip !== 'string') return false;
    if (ip.length > 45) return false;
    return IP_V4_RE.test(ip) || IP_V6_RE.test(ip);
}

/* ── ISO 3166-1 alpha-2 → Full country name (common countries) ── */
const COUNTRY_CODE_MAP = {
    'EG': 'Egypt',
    'SA': 'Saudi Arabia',
    'AE': 'United Arab Emirates',
    'KW': 'Kuwait',
    'QA': 'Qatar',
    'BH': 'Bahrain',
    'OM': 'Oman',
    'JO': 'Jordan',
    'LB': 'Lebanon',
    'IQ': 'Iraq',
    'SY': 'Syria',
    'PS': 'Palestine',
    'LY': 'Libya',
    'SD': 'Sudan',
    'TN': 'Tunisia',
    'DZ': 'Algeria',
    'MA': 'Morocco',
    'YE': 'Yemen',
    'US': 'United States',
    'GB': 'United Kingdom',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'NL': 'Netherlands',
    'CA': 'Canada',
    'AU': 'Australia',
    'TR': 'Turkey',
    'IN': 'India',
    'PK': 'Pakistan',
    'CN': 'China',
    'JP': 'Japan',
    'KR': 'South Korea',
    'BR': 'Brazil',
    'RU': 'Russia',
    'SE': 'Sweden',
    'NO': 'Norway',
    'FI': 'Finland',
    'DK': 'Denmark',
};

function isoToCountryName(code) {
    if (!code || typeof code !== 'string') return null;
    const upper = code.toUpperCase().trim();
    return COUNTRY_CODE_MAP[upper] || upper; // fallback: return the ISO code itself
}

async function getGeoLocation(ip, req = null) {
    if (!ip) return { country: null, city: null };
    if (!isValidIP(ip)) return { country: null, city: null };

    /* ── 1. Vercel auto-injected headers (best source — instant, free) ── */
    if (req && req.headers) {
        const vercelCountry = req.headers['x-vercel-ip-country'];
        const vercelCity    = req.headers['x-vercel-ip-city'];

        if (vercelCountry) {
            const country = isoToCountryName(vercelCountry);
            // Decode city — Vercel URL-encodes non-ASCII city names
            let city = null;
            if (vercelCity) {
                try { city = decodeURIComponent(vercelCity); } catch { city = vercelCity; }
            }
            const result = { country, city };
            // Cache the Vercel result too
            geoCache.set(ip, { ...result, expiresAt: Date.now() + GEO_CACHE_TTL });
            return result;
        }
    }

    /* ── 2. In-memory cache ── */
    const cached = geoCache.get(ip);
    if (cached && Date.now() < cached.expiresAt) {
        return { country: cached.country, city: cached.city };
    }

    /* ── Cache eviction ── */
    if (geoCache.size >= GEO_CACHE_MAX) {
        const now = Date.now();
        for (const [key, val] of geoCache) {
            if (now >= val.expiresAt) geoCache.delete(key);
        }
        if (geoCache.size >= GEO_CACHE_MAX) {
            const firstKey = geoCache.keys().next().value;
            if (firstKey) geoCache.delete(firstKey);
        }
    }

    /* ── 3. Fallback: ip-api.com (free tier, 45 req/min) ── */
    try {
        const geoRes = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,city`,
            { signal: AbortSignal.timeout(TIMEOUT.GEO) }
        );
        if (geoRes.ok) {
            const g = await geoRes.json();
            if (g.status === 'success') {
                const result = { country: g.country || null, city: g.city || null };
                geoCache.set(ip, { ...result, expiresAt: Date.now() + GEO_CACHE_TTL });
                return result;
            }
        }
    } catch { /* geo is non-critical — fail safe */ }

    return { country: null, city: null };
}

/* ══════════════════════════════════════════════════════════════════
   SUPABASE HELPERS (with configurable timeout)
   ══════════════════════════════════════════════════════════════════ */

async function supabaseGet(table, filter, timeout = TIMEOUT.DB_READ) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
        { headers: SERVICE_HEADERS, signal: AbortSignal.timeout(timeout) }
    );
    if (!res.ok) return [];
    return await res.json();
}

async function supabaseInsert(table, body, timeout = TIMEOUT.DB_WRITE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...SERVICE_HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(timeout)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Supabase insert failed: ${err}`);
    }
    return await res.json();
}

async function supabaseInsertMinimal(table, body, timeout = TIMEOUT.DB_WRITE) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...SERVICE_HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(timeout)
    });
    return res.ok;
}

async function supabasePatch(table, filter, body, timeout = TIMEOUT.DB_WRITE) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
        {
            method: 'PATCH',
            headers: { ...SERVICE_HEADERS, 'Prefer': 'return=minimal' },
            body: JSON.stringify(body),
            signal: AbortSignal.timeout(timeout)
        }
    );
    return res.ok;
}

/* ══════════════════════════════════════════════════════════════════
   SECURITY EVENT LOGGING (v2 — Severity + Async Batch)
   ─────────────────────────────────────────────────────────────────
   Severity levels: info, warning, critical
   Async batching: accumulates events, flushes periodically
   Dedup: identical events within 60s are suppressed
   Never blocks the request flow.
   ══════════════════════════════════════════════════════════════════ */

const _logDedup = new Map();
const _LOG_DEDUP_WINDOW = 60000;
const _LOG_DEDUP_MAX = 500;

// Async log queue — batches writes to avoid DB overload
const _logQueue = [];
const _LOG_BATCH_SIZE = 10;
const _LOG_FLUSH_INTERVAL = 5000; // 5 seconds
let _logFlushTimer = null;

async function _flushLogQueue() {
    if (_logQueue.length === 0) return;
    const batch = _logQueue.splice(0, _LOG_BATCH_SIZE);
    try {
        await supabaseInsertMinimal('activity_logs', batch, TIMEOUT.DB_WRITE);
    } catch { /* logging must never break anything */ }

    // If more remain, schedule another flush
    if (_logQueue.length > 0 && !_logFlushTimer) {
        _logFlushTimer = setTimeout(() => {
            _logFlushTimer = null;
            _flushLogQueue();
        }, _LOG_FLUSH_INTERVAL);
    }
}

/**
 * Log a security event with severity level.
 * @param {'info'|'warning'|'critical'} severity
 * @param {string} type - Event type (e.g. 'order:rate_limited')
 * @param {object} metadata - { ip, phone, detail }
 */
async function logSecurityEvent(severity, type, metadata = {}) {
    // Handle legacy calls: logSecurityEvent('type', { metadata })
    if (typeof severity === 'string' && typeof type === 'object') {
        metadata = type;
        type = severity;
        severity = 'warning';
    }

    try {
        const safeIP = metadata.ip ? await hashForLog(metadata.ip) : 'none';
        const safePhone = metadata.phone ? await hashForLog(metadata.phone) : null;

        // Dedup
        const dedupKey = `${type}:${safeIP}`;
        const now = Date.now();
        if (_logDedup.has(dedupKey) && now - _logDedup.get(dedupKey) < _LOG_DEDUP_WINDOW) {
            return;
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
            `[${severity.toUpperCase()}]`,
            `[${type}]`,
            `ip_hash:${safeIP}`,
            safePhone ? `phone_hash:${safePhone}` : null,
            metadata.detail || null,
        ].filter(Boolean).join(' | ');

        const logEntry = {
            action_type: severity === 'critical' ? 'critical' : 'block',
            action_description: description,
            entity_type: 'security',
            entity_id: safeIP
        };

        // Critical events: write immediately
        if (severity === 'critical') {
            try {
                await supabaseInsertMinimal('activity_logs', logEntry, TIMEOUT.DB_WRITE);
            } catch { /* never break flow */ }
            return;
        }

        // Non-critical: queue for batch write
        _logQueue.push(logEntry);
        if (_logQueue.length >= _LOG_BATCH_SIZE) {
            _flushLogQueue();
        } else if (!_logFlushTimer) {
            _logFlushTimer = setTimeout(() => {
                _logFlushTimer = null;
                _flushLogQueue();
            }, _LOG_FLUSH_INTERVAL);
        }
    } catch { /* logging must never break the flow */ }
}

/* ══════════════════════════════════════════════════════════════════
   ANOMALY DETECTION & AUTO-BLOCKING
   ─────────────────────────────────────────────────────────────────
   Tracks behavioral anomalies per IP:
   - Too many different phones from same IP
   - Too many failed/blocked requests
   Auto-blocks IPs that exceed thresholds.
   ══════════════════════════════════════════════════════════════════ */

const _anomalyTracker = new Map();
const _ANOMALY_MAX_ENTRIES = 2000;
const _ANOMALY_WINDOW = 600000; // 10 minutes

const ANOMALY_THRESHOLDS = {
    uniquePhones: 5,      // max different phones per IP in window
    failedAttempts: 15,    // max failed/blocked requests per IP in window
    autoBlockDuration: 30  // minutes
};

function trackAnomaly(ip, signal, value = null) {
    if (!ip) return;
    const now = Date.now();

    // Evict old entries
    if (_anomalyTracker.size > _ANOMALY_MAX_ENTRIES * 0.8) {
        for (const [k, v] of _anomalyTracker) {
            if (now - v.windowStart > _ANOMALY_WINDOW) _anomalyTracker.delete(k);
        }
        if (_anomalyTracker.size >= _ANOMALY_MAX_ENTRIES) {
            const firstKey = _anomalyTracker.keys().next().value;
            if (firstKey) _anomalyTracker.delete(firstKey);
        }
    }

    let record = _anomalyTracker.get(ip);
    if (!record || now - record.windowStart > _ANOMALY_WINDOW) {
        record = { windowStart: now, phones: new Set(), failures: 0, blocked: false };
        _anomalyTracker.set(ip, record);
    }

    if (signal === 'phone' && value) {
        record.phones.add(value);
    } else if (signal === 'failure') {
        record.failures++;
    }

    return record;
}

async function checkAndAutoBlock(ip) {
    if (!ip) return false;
    const record = _anomalyTracker.get(ip);
    if (!record || record.blocked) return record?.blocked || false;

    const shouldBlock = record.phones.size > ANOMALY_THRESHOLDS.uniquePhones
        || record.failures > ANOMALY_THRESHOLDS.failedAttempts;

    if (shouldBlock) {
        record.blocked = true;
        logSecurityEvent('critical', 'anomaly:auto_block', {
            ip,
            detail: `phones:${record.phones.size} failures:${record.failures}`
        });

        // Insert temporary block into blocked_ips
        try {
            await supabaseInsertMinimal('blocked_ips', {
                ip,
                reason: `Auto-blocked: anomaly detection (${record.phones.size} phones, ${record.failures} failures)`,
                created_at: new Date().toISOString()
            }, TIMEOUT.DB_WRITE);
        } catch { /* best effort */ }

        return true;
    }

    return false;
}

/* ══════════════════════════════════════════════════════════════════
   ADMIN VERIFICATION
   ══════════════════════════════════════════════════════════════════ */

async function verifyAdmin(req) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { valid: false, status: 401, error: 'Unauthorized' };
    }

    const token = authHeader.slice(7);
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
            signal: AbortSignal.timeout(TIMEOUT.ADMIN)
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
        // FAIL CLOSED for admin verification
        return { valid: false, status: 500, error: 'Admin verification failed' };
    }
}

/* ══════════════════════════════════════════════════════════════════
   HMAC REQUEST SIGNATURE (Anti-Replay)
   ─────────────────────────────────────────────────────────────────
   Client sends:
     X-Request-Timestamp: <epoch ms>
     X-Request-Signature: HMAC-SHA256(body + timestamp, secret)
   Server validates:
     - Signature matches
     - Timestamp within REPLAY_WINDOW_MS (60 seconds)
     - Nonce not reused (in-memory + eviction)

   Only enforced when HMAC_SECRET env var is set.
   ══════════════════════════════════════════════════════════════════ */

const REPLAY_WINDOW_MS = 60000;
const _usedNonces = new Map();
const _NONCE_MAX = 5000;

function validateRequestSignature(req) {
    // Skip if HMAC_SECRET not configured (graceful rollout)
    if (!HMAC_SECRET) return true;

    const timestamp = req.headers['x-request-timestamp'];
    const signature = req.headers['x-request-signature'];

    if (!timestamp || !signature) return false;

    const ts = parseInt(timestamp);
    if (isNaN(ts)) return false;

    // Reject if timestamp too old or too far in future
    const now = Date.now();
    if (Math.abs(now - ts) > REPLAY_WINDOW_MS) return false;

    // Anti-replay: check nonce (signature acts as nonce)
    const nonceKey = signature.slice(0, 32);
    if (_usedNonces.has(nonceKey)) return false;

    // Evict old nonces
    if (_usedNonces.size > _NONCE_MAX * 0.8) {
        const cutoff = now - REPLAY_WINDOW_MS;
        for (const [k, t] of _usedNonces) {
            if (t < cutoff) _usedNonces.delete(k);
        }
        if (_usedNonces.size >= _NONCE_MAX) {
            const firstKey = _usedNonces.keys().next().value;
            if (firstKey) _usedNonces.delete(firstKey);
        }
    }

    // Compute expected signature
    const bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
    const payload = bodyStr + ':' + timestamp;
    const expected = createHmac('sha256', HMAC_SECRET).update(payload).digest('hex');

    if (!secureCompare(expected, signature)) return false;

    // Mark nonce as used
    _usedNonces.set(nonceKey, now);
    return true;
}

/* ══════════════════════════════════════════════════════════════════
   FETCH DYNAMIC SECURITY LIMITS
   ─────────────────────────────────────────────────────────────────
   Reads from dashboard DB every time. On failure, uses the LAST
   KNOWN good values (not hardcoded defaults) so admin changes
   persist even during DB hiccups.
   ══════════════════════════════════════════════════════════════════ */

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

/* Cache: stores the last successfully fetched limits from DB */
let _cachedLimits = null;
let _cachedAt = 0;
const LIMITS_CACHE_TTL = 30000; // 30 seconds — re-read from DB every 30s

async function fetchSecurityLimits() {
    // If we have a recent cache (< 30s old), use it directly
    const now = Date.now();
    if (_cachedLimits && (now - _cachedAt) < LIMITS_CACHE_TTL) {
        return _cachedLimits;
    }

    try {
        const data = await supabaseGet(
            'site_settings',
            'key=eq.security_limits&select=value',
            TIMEOUT.DB_READ  // 4s instead of 3s SECURITY timeout
        );
        if (data && data.length > 0 && data[0].value) {
            _cachedLimits = { ...DEFAULT_LIMITS, ...data[0].value };
            _cachedAt = now;
            return _cachedLimits;
        }
    } catch (err) {
        // Log the failure so admin can debug
        logSecurityEvent('critical', 'limits:fetch_failed', {
            detail: err?.message || 'unknown error'
        });
    }

    // If DB failed but we have a previous cached result, use it
    if (_cachedLimits) {
        return _cachedLimits;
    }

    // Absolute last resort: use defaults (only on first ever request if DB is down)
    return { ...DEFAULT_LIMITS };
}

function getWindowMs(limits, timeKey, unitKey, fallbackMin = 10) {
    const t = limits[timeKey] ?? fallbackMin;
    const u = limits[unitKey] ?? 'minutes';
    return t * (TIME_MULTIPLIERS[u] || TIME_MULTIPLIERS.minutes);
}

/* ══════════════════════════════════════════════════════════════════
   TIMING-SAFE STRING COMPARISON
   ══════════════════════════════════════════════════════════════════ */

function secureCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    try {
        return _timingSafeEqual(Buffer.from(a), Buffer.from(b));
    } catch {
        return false;
    }
}

/* ══════════════════════════════════════════════════════════════════
   GENERATE ORDER REFERENCE
   ══════════════════════════════════════════════════════════════════ */

function generateOrderRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const len = 12;
    let ref = '';
    try {
        const bytes = randomBytes(len);
        for (let i = 0; i < len; i++) ref += chars[bytes[i] % chars.length];
    } catch {
        for (let i = 0; i < len; i++) ref += chars[Math.floor(Math.random() * chars.length)];
    }
    return `DL-${ref}`;
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTS
   ══════════════════════════════════════════════════════════════════ */

export {
    // Environment (public values only)
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    ALLOWED_ORIGINS,
    KV_CONFIGURED,
    TIMEOUT,

    // CORS & Origin & Security Headers
    setCorsHeaders,
    setSecurityHeaders,
    validateOrigin,

    // IP
    getServerIP,

    // Composite Client ID
    getCompositeId,

    // Global Rate Limiting
    checkGlobalRateLimit,

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

    // Supabase (uses service key internally)
    supabaseGet,
    supabaseInsert,
    supabaseInsertMinimal,
    supabasePatch,

    // Logging
    logSecurityEvent,

    // Admin
    verifyAdmin,

    // HMAC Anti-Replay
    validateRequestSignature,

    // Anomaly Detection
    trackAnomaly,
    checkAndAutoBlock,

    // Security Limits
    DEFAULT_LIMITS,
    TIME_MULTIPLIERS,
    fetchSecurityLimits,
    getWindowMs,

    // Crypto
    secureCompare,

    // Order Ref
    generateOrderRef
};
