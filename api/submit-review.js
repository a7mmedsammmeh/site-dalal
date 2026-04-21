/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Review Submission API (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/submit-review

   Security layers:
     1. Security headers + CORS
     2. Global rate limiting
     3. Origin + Referer validation
     4. Bot detection
     5. Honeypot check
     6. Timing check
     7. Composite client ID rate limiting
     8. KV rate limiting (FAIL CLOSED)
     9. Anomaly tracking
    10. Input validation + sanitization
    11. Duplicate order review check
    12. Auto-set is_visible = false
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, sanitizeOrNull, supabaseGet, supabaseInsert,
    logSecurityEvent, createMemoryRateLimiter, kvRateLimit,
    fetchSecurityLimits, getWindowMs,
    checkGlobalRateLimit, getCompositeId,
    trackAnomaly, KV_CONFIGURED, TIMEOUT
} from './_lib/security.js';

/* ── In-memory rate limiter ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 86400000, maxHits: 10 });

const MIN_FILL_TIME_MS = 3000;

export default async function handler(req, res) {

    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Global rate limiting ── */
    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    /* ── Bot detection ── */
    if (isBot(req)) {
        trackAnomaly(ip, 'failure');
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── Fetch dynamic limits ── */
    const LIMITS = await fetchSecurityLimits();
    const rateWindowMs = getWindowMs(LIMITS, 'review_window_time', 'review_window_unit', 24);
    const maxPerIp = LIMITS.review_max_per_ip || 10;
    rateLimiter.updateConfig(rateWindowMs, maxPerIp);

    /* ── In-memory rate limiting via composite ID ── */
    const body = req.body;
    const fpRaw = body && body.fingerprint ? sanitize(body.fingerprint, 64) : null;
    const compositeId = getCompositeId(ip, req, fpRaw);

    if (rateLimiter.check(compositeId)) {
        logSecurityEvent('warning', 'review:rate_limited', { ip });
        return res.status(429).json({ error: 'rate_limited', message: 'Too many reviews. Please try again later.' });
    }

    try {
        if (!body) return res.status(400).json({ error: 'Missing body' });

        /* ── Honeypot ── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            logSecurityEvent('warning', 'review:honeypot', { ip });
            trackAnomaly(ip, 'failure');
            return res.status(200).json({ success: true });
        }

        /* ── Timing check ── */
        if (body.form_opened_at) {
            const clientTimestamp = parseInt(body.form_opened_at);
            if (!isNaN(clientTimestamp)) {
                const elapsed = Date.now() - clientTimestamp;
                if (elapsed > 1000 && elapsed < MIN_FILL_TIME_MS) {
                    logSecurityEvent('warning', 'review:timing_suspect', { ip, detail: `elapsed:${elapsed}ms` });
                    trackAnomaly(ip, 'failure');
                    return res.status(200).json({ success: true });
                }
            }
        }

        /* ── Extract & validate fields ── */
        const { product_id, order_ref, rating, comment, reviewer_name, fingerprint, products } = body;

        const ratingNum = parseInt(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Invalid rating (must be 1-5)' });
        }

        const productIdNum = product_id ? parseInt(product_id) : null;
        if (product_id && (isNaN(productIdNum) || productIdNum < 1)) {
            return res.status(400).json({ error: 'Invalid product_id' });
        }

        const orderRefClean = order_ref ? sanitize(order_ref, 50) : null;
        if (orderRefClean && !/^DL-[A-Z0-9]{12}$/.test(orderRefClean)) {
            return res.status(400).json({ error: 'Invalid order reference' });
        }

        const commentClean = sanitize(comment || '', 1000);
        const nameClean = sanitizeOrNull(reviewer_name, 100);
        const fpClean = fingerprint ? sanitize(fingerprint, 64) : null;

        /* ── KV rate limiting (FAIL CLOSED) ── */
        if (ip) {
            const kvResult = await kvRateLimit(`review:${compositeId}`, rateWindowMs, maxPerIp);
            if (kvResult === true) {
                return res.status(429).json({ error: 'rate_limited', message: 'Review limit reached.' });
            }
            // DB fallback only if KV not configured
            if (kvResult === null) {
                try {
                    const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                    const ipReviews = await supabaseGet(
                        'reviews',
                        `client_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${windowTime}&select=id`,
                        TIMEOUT.SECURITY
                    );
                    if (ipReviews.length >= maxPerIp) {
                        return res.status(429).json({ error: 'rate_limited', message: 'Review limit reached.' });
                    }
                } catch {
                    // DB fallback failed — FAIL CLOSED
                    logSecurityEvent('critical', 'review:rate_check_failed', { ip });
                    return res.status(503).json({ error: 'Service temporarily unavailable' });
                }
            }
        }

        /* ── Duplicate order review check ── */
        if (orderRefClean) {
            try {
                const existing = await supabaseGet(
                    'reviews',
                    `order_ref=eq.${encodeURIComponent(orderRefClean)}&select=id&limit=1`,
                    TIMEOUT.SECURITY
                );
                if (existing.length > 0) {
                    return res.status(400).json({ error: 'already_reviewed', message: 'This order has already been reviewed.' });
                }
            } catch {
                // Duplicate check is security-relevant — FAIL CLOSED
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        /* ── Build review(s) — cap at 10 per request ── */
        let reviewsToInsert = [];

        if (products && Array.isArray(products) && products.length > 0) {
            const cappedProducts = products.slice(0, 10);
            const seenIds = new Set();
            for (const p of cappedProducts) {
                const pid = parseInt(p.id || p.product_id);
                if (!pid || pid < 1 || seenIds.has(pid)) continue;
                seenIds.add(pid);
                reviewsToInsert.push({
                    order_ref: orderRefClean,
                    product_id: pid,
                    reviewer_name: nameClean,
                    rating: ratingNum,
                    comment: commentClean,
                    client_ip: ip,
                    composite_id: compositeId,
                    is_visible: false
                });
            }
        }

        if (reviewsToInsert.length === 0) {
            reviewsToInsert = [{
                order_ref: orderRefClean,
                product_id: productIdNum,
                reviewer_name: nameClean,
                rating: ratingNum,
                comment: commentClean,
                client_ip: ip,
                composite_id: compositeId,
                is_visible: false
            }];
        }

        await supabaseInsert('reviews', reviewsToInsert);
        return res.status(200).json({ success: true });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
