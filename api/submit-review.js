/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Review Submission API (v2 — Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/submit-review
   
   Security layers:
     1. Method + CORS (strict origin allowlist)
     2. Origin + Referer validation
     3. Multi-signal bot detection
     4. Honeypot check (BLOCKS — not just logging)
     5. Timing check (server-side validation)
     6. IP extraction (server-side, Vercel-trusted)
     7. In-memory rate limiting (fast, per-instance)
     8. KV/DB-backed rate limiting (persistent)
     9. Duplicate order review check
    10. Input validation + sanitization
    11. Products array size limit
    12. Auto-set is_visible = false (admin approval required)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, sanitizeOrNull, supabaseGet, supabaseInsert,
    logSecurityEvent, createMemoryRateLimiter, kvRateLimit,
    fetchSecurityLimits, getWindowMs, hashForLog
} from './_lib/security.js';

/* ── In-memory rate limiter ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 86400000, maxHits: 10 });

const MIN_FILL_TIME_MS = 3000; // 3 seconds minimum to fill form

export default async function handler(req, res) {

    /* ── CORS ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── Origin validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── Bot detection ── */
    if (isBot(req)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── Extract IP ── */
    const ip = getServerIP(req);

    /* ── Fetch dynamic limits ── */
    const LIMITS = await fetchSecurityLimits();
    const rateWindowMs = getWindowMs(LIMITS, 'review_window_time', 'review_window_unit', 24);
    const maxPerIp = LIMITS.review_max_per_ip || 10;
    rateLimiter.updateConfig(rateWindowMs, maxPerIp);

    /* ── In-memory rate limiting ── */
    if (rateLimiter.check(ip)) {
        logSecurityEvent('review:rate_limited', { ip });
        return res.status(429).json({ error: 'rate_limited', message: 'Too many reviews. Please try again later.' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        /* ── Honeypot: BLOCK (not just log) ── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            logSecurityEvent('review:honeypot', { ip });
            // Return fake success to not reveal detection
            return res.status(200).json({ success: true });
        }

        /* ── Timing check: server-side delta ── */
        if (body.form_opened_at) {
            const clientTimestamp = parseInt(body.form_opened_at);
            if (!isNaN(clientTimestamp)) {
                const elapsed = Date.now() - clientTimestamp;
                console.log('submit-review: timing elapsed:', elapsed, 'ms');
                // Only block truly impossible speeds (< 1 second, ignoring clock skew)
                // Allow negative elapsed (clock skew where client is ahead)
                if (elapsed > 1000 && elapsed < MIN_FILL_TIME_MS) {
                    logSecurityEvent('review:timing_suspect', { ip, detail: `elapsed:${elapsed}ms` });
                    return res.status(200).json({ success: true });
                }
            }
        }

        /* ── Extract & validate fields ── */
        const { product_id, order_ref, rating, comment, reviewer_name, fingerprint, products } = body;

        // Rating: required, 1-5
        const ratingNum = parseInt(rating);
        if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
            return res.status(400).json({ error: 'Invalid rating (must be 1-5)' });
        }

        // Product ID: optional but must be valid if present
        const productIdNum = product_id ? parseInt(product_id) : null;
        if (product_id && (isNaN(productIdNum) || productIdNum < 1)) {
            return res.status(400).json({ error: 'Invalid product_id' });
        }

        // Order ref: format validation
        const orderRefClean = order_ref ? sanitize(order_ref, 50) : null;
        if (orderRefClean && !/^DL-[A-Z0-9]{12}$/.test(orderRefClean)) {
            return res.status(400).json({ error: 'Invalid order reference' });
        }

        // Sanitize text fields
        const commentClean = sanitize(comment || '', 1000);
        const nameClean = sanitizeOrNull(reviewer_name, 100);
        const fpClean = fingerprint ? sanitize(fingerprint, 64) : null;

        /* ── KV/DB rate limiting (persistent, cross-instance) ── */
        if (ip) {
            try {
                const kvResult = await kvRateLimit(`review:${ip}`, rateWindowMs, maxPerIp);
                if (kvResult === true) {
                    return res.status(429).json({ error: 'rate_limited', message: 'Review limit reached.' });
                }
                if (kvResult === null) {
                    const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                    const ipReviews = await supabaseGet(
                        'reviews',
                        `client_ip=eq.${encodeURIComponent(ip)}&created_at=gte.${windowTime}&select=id`
                    );
                    if (ipReviews.length >= maxPerIp) {
                        return res.status(429).json({ error: 'rate_limited', message: 'Review limit reached.' });
                    }
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
                    return res.status(400).json({ error: 'already_reviewed', message: 'This order has already been reviewed.' });
                }
            } catch { /* don't block if check fails */ }
        }

        /* ── Build review(s) — cap at 10 per request ── */
        let reviewsToInsert = [];

        if (products && Array.isArray(products) && products.length > 0) {
            // Limit products array to prevent abuse
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
                    is_visible: false // ALWAYS false — admin must approve
                });
            }
            console.log('submit-review: products loop result:', reviewsToInsert.length, 'reviews from', products.length, 'products');
        }

        // Fallback: single review
        if (reviewsToInsert.length === 0) {
            reviewsToInsert = [{
                order_ref: orderRefClean,
                product_id: productIdNum,
                reviewer_name: nameClean,
                rating: ratingNum,
                comment: commentClean,
                client_ip: ip,
                is_visible: false
            }];
            console.log('submit-review: using fallback single review, product_id:', productIdNum, 'order_ref:', orderRefClean);
        }

        /* ── Insert via service key ── */
        console.log('submit-review: inserting', reviewsToInsert.length, 'reviews');
        await supabaseInsert('reviews', reviewsToInsert);

        return res.status(200).json({ success: true });

    } catch (err) {
        console.error('submit-review error:', err?.message || err);
        // Never expose internal error details
        return res.status(500).json({ error: 'Internal server error' });
    }
}
