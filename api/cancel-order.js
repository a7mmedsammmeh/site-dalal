/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Cancellation API (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/cancel-order

   Security layers:
     1. Security headers + CORS (strict)
     2. Global rate limiting
     3. Origin + Referer validation
     4. Multi-signal bot detection
     5. HMAC anti-replay validation
     6. Rate limiting (composite ID)
     7. Order ref format validation
     8. Ownership verification (timing-safe fingerprint match)
     9. Status check (pending only)
    10. Generic error responses (prevent enumeration)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, supabaseGet, supabasePatch,
    logSecurityEvent, createMemoryRateLimiter, secureCompare,
    checkGlobalRateLimit, getCompositeId, validateRequestSignature,
    trackAnomaly, TIMEOUT
} from './_lib/security.js';

/* ── Rate limiter with max-size cap ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 600000, maxHits: 5 });

/* ── Order ref format ── */
const ORDER_REF_RE = /^DL-[A-Z0-9]{12}$/;

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

    /* ── HMAC Anti-Replay ── */
    if (!validateRequestSignature(req)) {
        logSecurityEvent('warning', 'cancel:hmac_failed', { ip });
        trackAnomaly(ip, 'failure');
        return res.status(403).json({ error: 'Invalid request signature' });
    }

    /* ── Composite ID rate limiting ── */
    const body = req.body;
    const fingerprint = sanitize((body && body.fingerprint) || '', 64);
    const compositeId = getCompositeId(ip, req, fingerprint);

    if (rateLimiter.check(compositeId)) {
        logSecurityEvent('warning', 'cancel:rate_limited', { ip });
        trackAnomaly(ip, 'failure');
        return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    try {
        if (!body) return res.status(400).json({ error: 'Missing body' });

        const orderRef = sanitize(body.order_ref || '', 20);

        /* ── Validate order_ref format ── */
        if (!orderRef || !ORDER_REF_RE.test(orderRef)) {
            return res.status(400).json({ error: 'Invalid order reference format' });
        }

        /* ── Fetch the order (FAIL CLOSED on timeout) ── */
        let orders;
        try {
            orders = await supabaseGet(
                'orders',
                `order_ref=eq.${encodeURIComponent(orderRef)}&select=id,status,fingerprint&limit=1`,
                TIMEOUT.SECURITY
            );
        } catch {
            return res.status(503).json({ error: 'Service temporarily unavailable' });
        }

        /* ── GENERIC response for not-found AND ownership failure ── */
        if (!orders || orders.length === 0) {
            logSecurityEvent('info', 'cancel:not_found', { ip, detail: `ref:${orderRef}` });
            trackAnomaly(ip, 'failure');
            return res.status(400).json({ error: 'cancel_failed', message: 'Cannot cancel this order' });
        }

        const order = orders[0];

        /* ── Ownership verification — timing-safe comparison ── */
        if (order.fingerprint) {
            if (!fingerprint || !secureCompare(order.fingerprint, fingerprint)) {
                logSecurityEvent('warning', 'cancel:ownership_fail', { ip, detail: `ref:${orderRef}` });
                trackAnomaly(ip, 'failure');
                return res.status(400).json({ error: 'cancel_failed', message: 'Cannot cancel this order' });
            }
        }

        /* ── Only pending orders can be cancelled ── */
        if (order.status !== 'pending') {
            return res.status(400).json({ error: 'cancel_failed', message: 'This order cannot be cancelled' });
        }

        /* ── Cancel: update status ── */
        const success = await supabasePatch(
            'orders',
            `id=eq.${encodeURIComponent(order.id)}`,
            { status: 'cancelled' }
        );

        if (!success) {
            return res.status(500).json({ error: 'Failed to cancel order' });
        }

        logSecurityEvent('info', 'cancel:success', { ip, detail: `ref:${orderRef}` });
        return res.status(200).json({ success: true, order_ref: orderRef });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
