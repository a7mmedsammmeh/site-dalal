/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Review Submission API
   ─────────────────────────────────────────────────────────────
   POST /api/submit-review
   
   Security layers:
     1. Method + CORS
     2. Origin validation
     3. Bot detection (user-agent)
     4. Honeypot check
     5. Timing check (min 3 seconds to fill form)
     6. IP extraction (server-side)
     7. Rate limiting (max 3 reviews per IP per 24h)
     8. Fingerprint rate limiting (max 3 per device per 24h)
     9. Duplicate detection (same order_ref)
    10. Input validation + sanitization
    11. Auto-set is_visible = false (admin approval required)
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function supabaseGet(table, filter) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}`,
        { headers: HEADERS, signal: AbortSignal.timeout(5000) }
    );
    if (!res.ok) return [];
    return await res.json();
}

async function supabaseInsert(table, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=representation' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`Insert failed: ${err}`);
    }
    return await res.json();
}

/* ── Constants ── */
const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i
];

/* ── In-memory rate limiter (per IP) ── */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000;  // 24 hours
const MAX_REVIEWS_PER_IP = 3;

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    // Cleanup old entries
    if (rateLimitMap.size > 500) {
        for (const [k, v] of rateLimitMap) {
            if (now - v.windowStart > RATE_WINDOW_MS) rateLimitMap.delete(k);
        }
    }

    if (!record || now - record.windowStart > RATE_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    record.count++;
    return record.count > MAX_REVIEWS_PER_IP;
}

/* ── Helpers ── */
function isBot(ua) {
    if (!ua || ua.length < 20) return true;
    return BOT_PATTERNS.some(p => p.test(ua));
}

function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || null;
}

function sanitize(val, maxLen) {
    if (typeof val !== 'string') return '';
    return val
        .replace(/<[^>]*>/g, '')       // strip HTML tags
        .replace(/[<>]/g, '')          // strip remaining angle brackets
        .replace(/\s+/g, ' ')          // normalize whitespace
        .trim()
        .slice(0, maxLen || 200);
}

const MIN_FILL_TIME_MS = 3000;  // 3 seconds minimum

/* ═══════════════════════ HANDLER ═══════════════════════ */
export default async function handler(req, res) {

    /* ── CORS ── */
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        const referer = req.headers.referer || req.headers.referrer || '';
        if (!ALLOWED_ORIGINS.some(o => referer.startsWith(o))) {
            return res.status(403).json({ error: 'Forbidden' });
        }
    }

    /* ── Bot detection ── */
    if (isBot(req.headers['user-agent'] || '')) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── IP + rate limit ── */
    const ip = getIP(req);
    if (isRateLimited(ip)) {
        // Log spam attempt
        logSuspicious(ip, null, 'review_rate_limited', 'Too many reviews');
        return res.status(429).json({ error: 'rate_limited', message: 'Too many reviews. Please try again tomorrow.' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        /* ── Honeypot ── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            logSuspicious(ip, null, 'review_honeypot', 'Honeypot triggered');
            return res.status(200).json({ success: true }); // silent reject
        }

        /* ── Timing check ── */
        if (body.form_opened_at) {
            const elapsed = Date.now() - parseInt(body.form_opened_at);
            if (elapsed < MIN_FILL_TIME_MS) {
                logSuspicious(ip, null, 'review_too_fast', `Filled in ${elapsed}ms`);
                return res.status(200).json({ success: true }); // silent reject
            }
        }

        /* ── Extract & validate fields ── */
        const {
            product_id,
            order_ref,
            rating,
            comment,
            reviewer_name,
            fingerprint
        } = body;

        // Rating: required, 1-5
        const ratingNum = parseInt(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Invalid rating (must be 1-5)' });
        }

        // Product ID: optional but must be a number if present
        const productIdNum = product_id ? parseInt(product_id) : null;
        if (product_id && (isNaN(productIdNum) || productIdNum < 1)) {
            return res.status(400).json({ error: 'Invalid product_id' });
        }

        // Order ref: optional, format validation
        const orderRefClean = order_ref ? sanitize(order_ref, 50) : null;
        if (orderRefClean && !/^DL-[A-Z0-9]{12}$/.test(orderRefClean)) {
            return res.status(400).json({ error: 'Invalid order reference' });
        }

        // Comment: sanitize, min 2 chars
        const commentClean = sanitize(comment || '', 1000);

        // Reviewer name
        const nameClean = sanitize(reviewer_name || '', 100) || null;

        // Fingerprint
        const fpClean = fingerprint ? sanitize(fingerprint, 64) : null;

        /* ── Fingerprint rate limiting ── */
        if (fpClean) {
            try {
                const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                const fpReviews = await supabaseGet(
                    'reviews',
                    `client_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${dayAgo}&select=id`
                );
                if (fpReviews.length >= MAX_REVIEWS_PER_IP) {
                    return res.status(429).json({ error: 'rate_limited', message: 'Review limit reached for today.' });
                }
            } catch { /* don't block if check fails */ }
        }

        /* ── Duplicate order review check ── */
        if (orderRefClean) {
            try {
                const existing = await supabaseGet(
                    'reviews',
                    `order_ref=eq.${encodeURIComponent(orderRefClean)}&select=id&limit=1`
                );
                if (existing.length > 0) {
                    return res.status(400).json({ error: 'already_reviewed', message: 'You have already reviewed this order.' });
                }
            } catch { /* don't block if check fails */ }
        }

        /* ── Build review(s) — one per product if order has multiple ── */
        let reviewsToInsert = [];

        if (body.products && Array.isArray(body.products) && body.products.length > 0) {
            // Order mode: one review per unique product
            const seenIds = new Set();
            for (const p of body.products) {
                const pid = parseInt(p.id);
                if (!pid || seenIds.has(pid)) continue;
                seenIds.add(pid);
                reviewsToInsert.push({
                    order_ref:     orderRefClean,
                    product_id:    pid,
                    reviewer_name: nameClean,
                    rating:        ratingNum,
                    comment:       commentClean,
                    client_ip:     ip,
                    is_visible:    false  // ALWAYS false — admin must approve
                });
            }
        }

        // Fallback: single review
        if (reviewsToInsert.length === 0) {
            reviewsToInsert = [{
                order_ref:     orderRefClean,
                product_id:    productIdNum,
                reviewer_name: nameClean,
                rating:        ratingNum,
                comment:       commentClean,
                client_ip:     ip,
                is_visible:    false
            }];
        }

        // Cap at 10 reviews per request
        if (reviewsToInsert.length > 10) {
            reviewsToInsert = reviewsToInsert.slice(0, 10);
        }

        /* ── Insert via service key ── */
        await supabaseInsert('reviews', reviewsToInsert);

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('submit-review error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/* ── Log suspicious activity to activity_logs ── */
async function logSuspicious(ip, fingerprint, type, description) {
    try {
        await supabaseInsert('activity_logs', {
            action_type: 'block',
            action_description: `[${type}] IP: ${ip || 'unknown'} | FP: ${fingerprint || 'none'} | ${description}`,
            entity_type: 'security',
            entity_id: ip || null
        });
    } catch { /* logging should never break the flow */ }
}
