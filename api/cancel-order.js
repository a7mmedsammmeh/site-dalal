/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Cancellation API
   ─────────────────────────────────────────────────────────────
   POST /api/cancel-order
   
   Server-side security layers:
     1. Method + CORS
     2. Origin validation
     3. Bot detection
     4. Field validation (order_ref format)
     5. Rate limiting (per IP — max 5 cancels per 10 min)
     6. Ownership-proof not required (guest system) BUT:
        - Only pending orders can be cancelled
        - ONLY status field is changed — nothing else
        - Uses service key to bypass RLS safely
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

/* ── In-memory rate limiter ── */
const rateLimitMap = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;  // 10 minutes
const MAX_PER_IP     = 5;                // max 5 cancellations per IP per window

function isRateLimited(ip) {
    if (!ip) return false;
    const now = Date.now();
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
    if (!userAgent) return true;
    if (userAgent.length < 20) return true;
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
        const refererAllowed = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
        if (!refererAllowed) {
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
        return res.status(429).json({ error: 'Too many requests. Please wait.' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        const orderRef = (body.order_ref || '').trim();

        /* ── Validate order_ref format ── */
        if (!orderRef || !ORDER_REF_RE.test(orderRef)) {
            return res.status(400).json({ error: 'Invalid order reference format' });
        }

        /* ── Fetch the order to verify it's pending ── */
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/orders?order_ref=eq.${encodeURIComponent(orderRef)}&select=id,status&limit=1`,
            { headers: HEADERS, signal: AbortSignal.timeout(5000) }
        );

        if (!fetchRes.ok) {
            return res.status(500).json({ error: 'Failed to check order' });
        }

        const orders = await fetchRes.json();

        if (!orders || orders.length === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        const order = orders[0];

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
            const err = await updateRes.text();
            console.error('Cancel order update failed:', err);
            return res.status(500).json({ error: 'Failed to cancel order' });
        }

        return res.status(200).json({ success: true, order_ref: orderRef });

    } catch (err) {
        console.error('cancel-order error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
