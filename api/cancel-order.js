/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Cancellation API (v2)
   ─────────────────────────────────────────────────────────────
   POST /api/cancel-order
   
   Security layers:
     1. Method + CORS
     2. Origin validation
     3. Bot detection
     4. Rate limiting (per IP — max 5 cancels per 10 min)
     5. Order ref format validation
     6. Ownership verification (fingerprint match)
     7. Status check (pending only)
     8. Suspicious activity logging
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
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(Array.isArray(body) ? body : [body]),
        signal: AbortSignal.timeout(5000)
    });
    return res.ok;
}

/* ── Trusted origins allowlist ── */
const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

/* ── In-memory rate limiter ── */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const MAX_PER_IP     = 5;                // max 5 cancellations per IP per window

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();

    // Cleanup old entries
    if (rateLimitMap.size > 300) {
        for (const [k, v] of rateLimitMap) {
            if (now - v.windowStart > RATE_WINDOW_MS) rateLimitMap.delete(k);
        }
    }

    const record = rateLimitMap.get(ip);
    if (!record || now - record.windowStart > RATE_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    record.count++;
    return record.count > MAX_PER_IP;
}

/* ── Bot detection ── */
const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i
];

function isBot(userAgent) {
    if (!userAgent || userAgent.length < 20) return true;
    return BOT_PATTERNS.some(p => p.test(userAgent));
}

/* ── Extract real IP ── */
function getIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || null;
}

/* ── Order ref validation ── */
const ORDER_REF_RE = /^DL-[A-Z0-9]{12}$/;

/* ── Log suspicious activity ── */
async function logSuspicious(ip, type, description) {
    try {
        await supabaseInsert('activity_logs', {
            action_type: 'block',
            action_description: `[cancel:${type}] IP: ${ip || '?'} | ${description}`,
            entity_type: 'security',
            entity_id: ip || null
        });
    } catch { /* logging should never break the flow */ }
}


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
    const userAgent = req.headers['user-agent'] || '';
    if (isBot(userAgent)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── Extract IP & rate limit ── */
    const ip = getIP(req);
    if (isRateLimited(ip)) {
        logSuspicious(ip, 'rate_limited', 'Cancel rate limit exceeded');
        return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        const orderRef   = (body.order_ref || '').trim();
        const fingerprint = (body.fingerprint || '').trim();

        /* ── Validate order_ref format ── */
        if (!orderRef || !ORDER_REF_RE.test(orderRef)) {
            return res.status(400).json({ error: 'Invalid order reference format' });
        }

        /* ── Fetch the order (include fingerprint for ownership check) ── */
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?order_ref=eq.${encodeURIComponent(orderRef)}&select=id,status,fingerprint,phone&limit=1`,
            { headers: HEADERS, signal: AbortSignal.timeout(5000) }
        );

        if (!fetchRes.ok) {
            return res.status(500).json({ error: 'Failed to check order' });
        }

        const orders = await fetchRes.json();

        if (!orders || orders.length === 0) {
            logSuspicious(ip, 'not_found', `Cancel attempt for non-existent order: ${orderRef}`);
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

        /* ── Ownership verification ── */
        // If order has a fingerprint, the canceller must provide a matching one
        if (order.fingerprint && fingerprint) {
            if (order.fingerprint !== fingerprint) {
                logSuspicious(ip, 'fp_mismatch', `Fingerprint mismatch on cancel: ${orderRef}`);
                return res.status(403).json({
                    error: 'ownership_failed',
                    message: 'Cannot verify order ownership'
                });
            }
        }
        // If no fingerprint from either side, allow (backward compatibility)
        // But if order HAS fingerprint and canceller provides NONE, be cautious
        if (order.fingerprint && !fingerprint) {
            logSuspicious(ip, 'no_fp', `Cancel without fingerprint: ${orderRef}`);
            // Still allow — some browsers block fingerprinting
        }

        /* ── Only pending orders can be cancelled ── */
        if (order.status !== 'pending') {
            return res.status(400).json({
                error: 'cannot_cancel',
                message: 'Only pending orders can be cancelled'
            });
        }

        /* ── Cancel: update ONLY the status field ── */
        const updateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?id=eq.${order.id}`,
            {
                method: 'PATCH',
                headers: { ...HEADERS, 'Prefer': 'return=minimal' },
                body: JSON.stringify({ status: 'cancelled' }),
                signal: AbortSignal.timeout(5000)
            }
        );

        if (!updateRes.ok) {
            console.error('Cancel order update failed:', await updateRes.text());
            return res.status(500).json({ error: 'Failed to cancel order' });
        }

        // Log the cancellation
        supabaseInsert('activity_logs', {
            action_type: 'update',
            action_description: `Order ${orderRef} cancelled by customer (IP: ${ip || 'unknown'})`,
            entity_type: 'order',
            entity_id: orderRef
        }).catch(() => {});

        return res.status(200).json({ success: true, order_ref: orderRef });

    } catch (err) {
        console.error('cancel-order error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
