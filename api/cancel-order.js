/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Cancellation API (v3 — Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/cancel-order
   
   Security layers:
     1. Method + CORS (strict)
     2. Origin + Referer validation
     3. Multi-signal bot detection
     4. Rate limiting (per IP — max 5 per 10 min, with max-size)
     5. Order ref format validation
     6. Ownership verification (fingerprint match)
     7. Status check (pending only)
     8. Generic error responses (prevent enumeration)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, supabaseGet, supabaseInsertMinimal, supabasePatch,
    logSecurityEvent, createMemoryRateLimiter,
    SERVICE_HEADERS, SUPABASE_URL
} from './_lib/security.js';

/* ── Rate limiter with max-size cap ── */
const rateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 600000, maxHits: 5 });

/* ── Order ref format ── */
const ORDER_REF_RE = /^DL-[A-Z0-9]{12}$/;

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

    /* ── IP + Rate limiting ── */
    const ip = getServerIP(req);
    if (rateLimiter.check(ip)) {
        logSecurityEvent('cancel:rate_limited', { ip });
        return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        const orderRef = sanitize(body.order_ref || '', 20);
        const fingerprint = sanitize(body.fingerprint || '', 64);

        /* ── Validate order_ref format ── */
        if (!orderRef || !ORDER_REF_RE.test(orderRef)) {
            return res.status(400).json({ error: 'Invalid order reference format' });
        }

        /* ── Fetch the order ── */
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?order_ref=eq.${encodeURIComponent(orderRef)}&select=id,status,fingerprint&limit=1`,
            { headers: SERVICE_HEADERS, signal: AbortSignal.timeout(5000) }
        );

        if (!fetchRes.ok) {
            return res.status(500).json({ error: 'Failed to process request' });
        }

        const orders = await fetchRes.json();

        /* ── GENERIC response for not-found AND ownership failure ──
           Prevents enumeration of valid order refs */
        if (!orders || orders.length === 0) {
            logSecurityEvent('cancel:not_found', { ip, detail: `ref:${orderRef}` });
            return res.status(400).json({
                error: 'cancel_failed',
                message: 'Cannot cancel this order'
            });
        }

        const order = orders[0];

        /* ── Ownership verification — SAME generic error ── */
        if (order.fingerprint) {
            if (!fingerprint || order.fingerprint !== fingerprint) {
                logSecurityEvent('cancel:ownership_fail', { ip, detail: `ref:${orderRef}` });
                return res.status(400).json({
                    error: 'cancel_failed',
                    message: 'Cannot cancel this order'
                });
            }
        }

        /* ── Only pending orders can be cancelled ── */
        if (order.status !== 'pending') {
            return res.status(400).json({
                error: 'cancel_failed',
                message: 'This order cannot be cancelled'
            });
        }

        /* ── Cancel: update status ── */
        const success = await supabasePatch(
            'orders',
            `id=eq.${order.id}`,
            { status: 'cancelled' }
        );

        if (!success) {
            return res.status(500).json({ error: 'Failed to cancel order' });
        }

        // Log cancellation (IP hashed in logSecurityEvent internally)
        logSecurityEvent('cancel:success', { ip, detail: `ref:${orderRef}` });

        return res.status(200).json({ success: true, order_ref: orderRef });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
