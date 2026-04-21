/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Creation API
   ─────────────────────────────────────────────────────────────
   POST /api/create-order
   
   Server-side security layers (in order):
     1. Method + CORS
     2. Origin validation (strict — rejects unknown origins)
     3. Bot detection (user-agent analysis)
     4. Honeypot check (server-side)
     5. IP extraction from headers (NOT from client body)
     6. IP blocking check (against blocked_ips table)
     7. Fingerprint blocking check (against blocked_fingerprints)
     8. Phone blocking check (against blocked_phones)
     9. In-memory rate limiting (fast, per IP — 3/10min)
    10. DB-backed rate limiting (persistent, per IP + fingerprint)
    11. Duplicate payload detection (per IP — 2min window)
    12. Field validation + sanitization
    13. Stock check
    14. Server-side price calculation (from DB)
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

/* ── Supabase helpers ── */
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
        throw new Error(`Supabase insert failed: ${err}`);
    }
    return await res.json();
}

/* ── Generate order ref ── */
function generateOrderRef() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const len = 12;
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let ref = '';
    for (let i = 0; i < len; i++) ref += chars[arr[i] % chars.length];
    return `DL-${ref}`;
}

/* ── Trusted origins allowlist ── */
const ALLOWED_ORIGINS = [
    'https://dalalwear.shop',
    'https://www.dalalwear.shop',
    'https://dalal-lin.vercel.app'
];

/* ═══════════════════════════════════════════════════════════════
   SECURITY LAYER: In-Memory Rate Limiting
   ─────────────────────────────────────────────────────────────
   Fast first-line defense. Vercel serverless functions share
   memory within a warm instance, so this blocks rapid-fire
   spam within the same instance lifecycle.
   DB-backed rate limiting (below) provides persistent checks.
   ═══════════════════════════════════════════════════════════════ */
const rateLimitMap = new Map();
let RATE_WINDOW_MS  = 10 * 60 * 1000;  // 10 minutes default
let MAX_PER_IP_MEM  = 3;               // max 3 orders per IP per window

function checkMemoryRateLimit(ip) {
    if (!ip) return false;
    const now = Date.now();
    const record = rateLimitMap.get(ip);

    if (!record || now - record.windowStart > RATE_WINDOW_MS) {
        rateLimitMap.set(ip, { count: 1, windowStart: now });
        return false;
    }

    record.count++;
    return record.count > MAX_PER_IP_MEM;
}

// Clean up old entries periodically to prevent memory leaks
function cleanupRateLimitMap() {
    const now = Date.now();
    for (const [ip, record] of rateLimitMap) {
        if (now - record.windowStart > RATE_WINDOW_MS) {
            rateLimitMap.delete(ip);
        }
    }
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY LAYER: Duplicate Payload Detection
   ─────────────────────────────────────────────────────────────
   Blocks identical orders from the same IP within 2 minutes.
   Prevents accidental double-clicks AND scripted replay attacks.
   ═══════════════════════════════════════════════════════════════ */
const recentPayloads = new Map();
let DEDUP_WINDOW_MS = 2 * 60 * 1000;  // 2 minutes default

function isDuplicatePayload(ip, payloadHash) {
    if (!ip) return false;
    const key = `${ip}:${payloadHash}`;
    const now = Date.now();

    // Clean old entries
    for (const [k, ts] of recentPayloads) {
        if (now - ts > DEDUP_WINDOW_MS) recentPayloads.delete(k);
    }

    if (recentPayloads.has(key)) return true;
    recentPayloads.set(key, now);
    return false;
}

function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash).toString(36);
}

/* ═══════════════════════════════════════════════════════════════
   SECURITY LAYER: Phone Cooldown
   ─────────────────────────────────────────────────────────────
   Same phone number cannot place more than 1 order every 2 min.
   Prevents phone-number-based spam even with IP/device changes.
   ═══════════════════════════════════════════════════════════════ */
const phoneCooldownMap = new Map();
let PHONE_COOLDOWN_MS = 2 * 60 * 1000;  // 2 minutes default

function isPhoneOnCooldown(normalizedPhone) {
    if (!normalizedPhone) return false;
    const now = Date.now();
    const lastOrder = phoneCooldownMap.get(normalizedPhone);

    // Cleanup old entries
    if (phoneCooldownMap.size > 300) {
        for (const [k, v] of phoneCooldownMap) {
            if (now - v > PHONE_COOLDOWN_MS) phoneCooldownMap.delete(k);
        }
    }

    if (lastOrder && now - lastOrder < PHONE_COOLDOWN_MS) return true;
    phoneCooldownMap.set(normalizedPhone, now);
    return false;
}

/* ── Log suspicious activity to activity_logs ── */
async function logSuspicious(ip, type, description) {
    try {
        await supabaseInsert('activity_logs', {
            action_type: 'block',
            action_description: `[order:${type}] IP: ${ip || '?'} | ${description}`,
            entity_type: 'security',
            entity_id: ip || null
        });
    } catch { /* logging should never break the flow */ }
}


/* ═══════════════════════════════════════════════════════════════
   SECURITY LAYER: Bot Detection
   ─────────────────────────────────────────────────────────────
   Rejects requests from known bots, scripts, and headless
   browsers based on user-agent analysis.
   ═══════════════════════════════════════════════════════════════ */
const BOT_PATTERNS = [
    /bot/i, /crawl/i, /spider/i, /scrape/i, /curl/i, /wget/i,
    /python-requests/i, /axios/i, /node-fetch/i, /postman/i,
    /headless/i, /phantom/i, /selenium/i, /puppeteer/i,
    /httpie/i, /insomnia/i, /go-http/i, /java\//i, /libwww/i
];

function isBot(userAgent) {
    if (!userAgent) return true;
    if (userAgent.length < 20) return true;  // Too short = suspicious
    return BOT_PATTERNS.some(p => p.test(userAgent));
}

/* ── Extract real IP from request headers ── */
function getServerIP(req) {
    return req.headers['x-forwarded-for']?.split(',')[0].trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || null;
}

/* ── Sanitize string ── */
function sanitize(val, maxLen) {
    if (typeof val !== 'string') return '';
    return val.substring(0, maxLen).trim();
}

/* ── Normalize Egyptian phone number ── */
/* Strips country codes & leading zeros so blocking works for ALL formats:
   01221808060 / +201221808060 / 201221808060 / 00201221808060 → 1221808060 */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0020') && cleaned.length >= 14) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('20') && cleaned.length >= 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length >= 11) cleaned = cleaned.slice(1);
    return cleaned;
}


/* ═══════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {

    // Periodic cleanup
    cleanupRateLimitMap();

    /* ──────────────────────────────────────────────────────────
       LAYER 1: Method + CORS
       ────────────────────────────────────────────────────────── */
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ──────────────────────────────────────────────────────────
       LAYER 2.5: Fetch Dynamic Security Limits
       ────────────────────────────────────────────────────────── */
    let LIMITS = {
        order_max_per_ip: 3,
        order_window_time: 10,
        order_window_unit: 'minutes',
        phone_cooldown_time: 2,
        phone_cooldown_unit: 'minutes',
        duplicate_window_time: 2,
        duplicate_window_unit: 'minutes',
        max_items_per_order: 20
    };
    try {
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/site_settings?key=eq.security_limits&select=value`,
            { headers: HEADERS, signal: AbortSignal.timeout(4000) }
        );
        if (fetchRes.ok) {
            const data = await fetchRes.json();
            if (data && data.length > 0) {
                LIMITS = { ...LIMITS, ...(data[0].value || {}) };
            }
        }
    } catch { /* proceed with defaults */ }

    const multipliers = { minutes: 60 * 1000, hours: 60 * 60 * 1000, days: 24 * 60 * 60 * 1000, weeks: 7 * 24 * 60 * 60 * 1000 };
    
    const getMs = (timeKey, unitKey, fallbackMin) => {
        const t = LIMITS[timeKey] ?? fallbackMin;
        const u = LIMITS[unitKey] ?? 'minutes';
        return t * (multipliers[u] || multipliers.minutes);
    };

    // Update in-memory constants using dynamic limits
    RATE_WINDOW_MS = getMs('order_window_time', 'order_window_unit', LIMITS.order_window_min ?? 10);
    MAX_PER_IP_MEM = LIMITS.order_max_per_ip;
    DEDUP_WINDOW_MS = getMs('duplicate_window_time', 'duplicate_window_unit', LIMITS.duplicate_window_min ?? 2);
    PHONE_COOLDOWN_MS = getMs('phone_cooldown_time', 'phone_cooldown_unit', LIMITS.phone_cooldown_min ?? 2);

    /* ──────────────────────────────────────────────────────────
       LAYER 2: Origin Validation
       Same-origin POST may not include Origin header, so we
       only reject when Origin IS present and NOT in allowlist.
       Referer header is checked as fallback.
       ────────────────────────────────────────────────────────── */
    if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        const referer = req.headers.referer || req.headers.referrer || '';
        const refererAllowed = ALLOWED_ORIGINS.some(o => referer.startsWith(o));
        if (!refererAllowed) {
            return res.status(403).json({ error: 'Forbidden: origin not allowed' });
        }
    }

    /* ──────────────────────────────────────────────────────────
       LAYER 3: Bot Detection
       ────────────────────────────────────────────────────────── */
    const userAgent = req.headers['user-agent'] || '';
    if (isBot(userAgent)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ──────────────────────────────────────────────────────────
       LAYER 4: Basic header validation
       Real browsers always send these headers.
       ────────────────────────────────────────────────────────── */
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid content type' });
    }

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        /* ──────────────────────────────────────────────────────
           LAYER 5: Honeypot Check (SERVER-SIDE)
           If the hidden "dalal_website" field is filled, it's a bot.
           ────────────────────────────────────────────────────── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            // Silently reject — don't reveal detection
            return res.status(200).json({
                success: true,
                order_ref: 'DL-' + Math.random().toString(36).substring(2, 14).toUpperCase(),
                id: null,
                total: 0,
                products: []
            });
        }

        /* ──────────────────────────────────────────────────────
           LAYER 6: Extract REAL IP from server headers
           NEVER trust client-provided IP.
           ────────────────────────────────────────────────────── */
        const serverIP = getServerIP(req);

        const { name, phone, email, address, lang, items, fingerprint } = body;

        /* ──────────────────────────────────────────────────────
           LAYER 7: In-Memory Rate Limiting (fast)
           ────────────────────────────────────────────────────── */
        if (checkMemoryRateLimit(serverIP)) {
            logSuspicious(serverIP, 'rate_limited', 'In-memory rate limit exceeded');
            return res.status(429).json({
                error: 'rate_limited',
                message: 'Too many orders. Please wait.'
            });
        }

        /* ──────────────────────────────────────────────────────
           LAYER 8: IP Blocking Check (against blocked_ips table)
           ────────────────────────────────────────────────────── */
        if (serverIP) {
            try {
                const ipCheck = await supabaseGet(
                    'blocked_ips',
                    `ip=eq.${encodeURIComponent(serverIP)}&select=ip,reason&limit=1`
                );
                if (ipCheck.length > 0) {
                    return res.status(403).json({
                        error: 'ip_blocked',
                        message: 'Your access has been restricted.'
                    });
                }
            } catch (e) { /* don't block order if check fails */ }
        }

        /* ──────────────────────────────────────────────────────
           LAYER 9: Fingerprint Blocking Check
           ────────────────────────────────────────────────────── */
        if (fingerprint) {
            try {
                const fpCheck = await supabaseGet(
                    'blocked_fingerprints',
                    `fingerprint=eq.${encodeURIComponent(fingerprint)}&select=fingerprint,reason&limit=1`
                );
                if (fpCheck.length > 0) {
                    return res.status(403).json({
                        error: 'device_blocked',
                        message: 'Your device has been restricted.'
                    });
                }
            } catch (e) { /* don't block order if check fails */ }
        }

        /* ──────────────────────────────────────────────────────
           LAYER 10: Phone Blocking Check
           ────────────────────────────────────────────────────── */
        if (!name || !phone || !address) {
            return res.status(400).json({ error: 'Missing required fields: name, phone, address' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or empty items array' });
        }

        // Limit items count to prevent abuse
        if (items.length > LIMITS.max_items_per_order) {
            return res.status(400).json({ error: 'Too many items in order' });
        }

        try {
            const normalizedInput = normalizePhone(phone);
            const blockedPhones = await supabaseGet(
                'blocked_phones',
                `select=phone,reason`
            );
            const matchedBlock = blockedPhones.find(bp => normalizePhone(bp.phone) === normalizedInput);
            if (matchedBlock) {
                return res.status(403).json({
                    error: 'phone_blocked',
                    message: 'This phone number is blocked from placing orders.'
                });
            }
        } catch (e) { /* don't block order if check fails */ }

        /* ──────────────────────────────────────────────────────
           LAYER 11: DB-Backed Rate Limiting (persistent)
           Uses server-extracted IP — NOT client-provided.
           ────────────────────────────────────────────────────── */
        const MAX_PER_IP = LIMITS.order_max_per_ip;
        const MAX_PER_FP = LIMITS.order_max_per_ip; // usually same as IP max
        const windowTime = new Date(Date.now() - RATE_WINDOW_MS).toISOString();

        try {
            // Rate limit by server-side IP
            if (serverIP) {
                const ipOrders = await supabaseGet(
                    'orders',
                    `client_ip=eq.${encodeURIComponent(serverIP)}&created_at=gte.${windowTime}&select=id`
                );
                if (ipOrders.length >= MAX_PER_IP) {
                    return res.status(429).json({
                        error: 'rate_limited',
                        message: 'Too many orders. Please wait.'
                    });
                }
            }

            // Rate limit by fingerprint (catches VPN / IP changers)
            if (fingerprint) {
                const fpOrders = await supabaseGet(
                    'orders',
                    `fingerprint=eq.${encodeURIComponent(fingerprint)}&created_at=gte.${windowTime}&select=id`
                );
                if (fpOrders.length >= MAX_PER_FP) {
                    return res.status(429).json({
                        error: 'rate_limited',
                        message: 'Too many orders from this device. Please wait.'
                    });
                }
            }
        } catch (e) { /* don't block order if rate check fails */ }

        /* ──────────────────────────────────────────────────────
           LAYER 12: Duplicate Payload Detection
           Blocks identical orders from same IP within 2 min.
           ────────────────────────────────────────────────────── */
        const payloadHash = simpleHash(JSON.stringify({ phone, address, items }));
        if (isDuplicatePayload(serverIP, payloadHash)) {
            logSuspicious(serverIP, 'duplicate', `Duplicate payload from phone: ${normalizePhone(phone)}`);
            return res.status(429).json({
                error: 'duplicate',
                message: 'This order was already submitted. Please wait.'
            });
        }

        /* ──────────────────────────────────────────────────────
           LAYER 12b: Phone Cooldown
           Same phone → max 1 order per 2 minutes.
           ────────────────────────────────────────────────────── */
        const normalizedPhone = normalizePhone(phone);
        if (isPhoneOnCooldown(normalizedPhone)) {
            logSuspicious(serverIP, 'phone_cooldown', `Phone cooldown: ${normalizedPhone}`);
            return res.status(429).json({
                error: 'rate_limited',
                message: 'Please wait before placing another order.'
            });
        }

        /* ──────────────────────────────────────────────────────
           LAYER 13: Fetch geolocation server-side
           ────────────────────────────────────────────────────── */
        let serverCountry = null, serverCity = null;
        if (serverIP) {
            try {
                const geoRes = await fetch(
                    `http://ip-api.com/json/${serverIP}?fields=status,country,city`,
                    { signal: AbortSignal.timeout(3000) }
                );
                if (geoRes.ok) {
                    const g = await geoRes.json();
                    if (g.status === 'success') {
                        serverCountry = g.country || null;
                        serverCity    = g.city    || null;
                    }
                }
            } catch { /* geo is optional */ }
        }

        /* ══════════════════════════════════════════════════════
           BUSINESS LOGIC (unchanged — stock + price validation)
           ══════════════════════════════════════════════════════ */

        /* ── Collect all unique product IDs ── */
        const productIds = [...new Set(items.map(i => i.product_id))];

        /* ── Fetch product stock status ── */
        try {
            const stockData = await supabaseGet(
                'product_stock',
                `product_id=in.(${productIds.join(',')})`
            );
            const stockMap = {};
            stockData.forEach(s => { stockMap[s.product_id] = s; });

            const outOfStock = [];
            for (const item of items) {
                const stock = stockMap[item.product_id];
                if (stock && stock.visibility_status !== 'visible') {
                    outOfStock.push(item.product_id);
                }
            }
            if (outOfStock.length > 0) {
                return res.status(400).json({
                    error: 'out_of_stock',
                    product_ids: outOfStock,
                    message: 'Some products are out of stock.'
                });
            }
        } catch (e) { /* don't block order if stock check fails */ }

        /* ── Fetch REAL prices from database ── */
        const pricingData = await supabaseGet(
            'product_pricing',
            `product_id=in.(${productIds.join(',')})&select=product_id,language,label,value,offer_order&order=offer_order`
        );

        // Group pricing by product_id and language
        const pricingMap = {};
        pricingData.forEach(p => {
            const key = `${p.product_id}_${p.language}`;
            if (!pricingMap[key]) pricingMap[key] = [];
            pricingMap[key].push(p);
        });

        /* ── Fetch product names from database ── */
        const productsData = await supabaseGet(
            'products',
            `id=in.(${productIds.join(',')})&select=id,name_ar,name_en,code,slug`
        );
        const productsMap = {};
        productsData.forEach(p => { productsMap[p.id] = p; });

        /* ── Build validated products array & calculate real total ── */
        const validatedProducts = [];
        let serverTotal = 0;

        for (const item of items) {
            const pid = item.product_id;
            const offerIndex = parseInt(item.offer_index);
            const qty = Math.max(1, Math.min(parseInt(item.qty) || 1, 99)); // Cap qty at 99
            const itemLang = lang || 'ar';

            // Get pricing for this product in the requested language
            const key = `${pid}_${itemLang}`;
            const fallbackKey = `${pid}_ar`;
            let productPricing = pricingMap[key] || pricingMap[fallbackKey] || [];

            // Sort by offer_order
            productPricing.sort((a, b) => a.offer_order - b.offer_order);

            if (productPricing.length === 0) {
                return res.status(400).json({
                    error: 'invalid_product',
                    product_id: pid,
                    message: `No pricing found for product ${pid}`
                });
            }

            if (offerIndex < 0 || offerIndex >= productPricing.length) {
                return res.status(400).json({
                    error: 'invalid_offer',
                    product_id: pid,
                    message: `Invalid offer index ${offerIndex} for product ${pid}`
                });
            }

            const realOffer = productPricing[offerIndex];
            const realPrice = parseFloat(realOffer.value.replace(/[^\d.]/g, '')) || 0;

            const productInfo = productsMap[pid] || {};
            const isAr = itemLang === 'ar';

            validatedProducts.push({
                id: pid,
                code: productInfo.code || sanitize(item.code, 20),
                name: isAr ? (productInfo.name_ar || '') : (productInfo.name_en || productInfo.name_ar || ''),
                size: sanitize(item.size, 50),
                color: sanitize(item.color, 50),
                notes: sanitize(item.notes, 200),
                offer: realOffer.label,   // ← FROM DATABASE, not client
                price: realOffer.value,   // ← FROM DATABASE, not client
                qty: qty
            });

            serverTotal += realPrice * qty;
        }

        /* ── Generate order ref ── */
        const orderRef = generateOrderRef();

        /* ── Insert order with SERVER-VALIDATED data ── */
        const orderData = {
            name: sanitize(name, 100),
            phone: sanitize(phone, 20),
            email: email ? sanitize(email, 100) : null,
            address: sanitize(address, 300),
            lang: lang || 'ar',
            products: validatedProducts,
            total: serverTotal,                // ← CALCULATED BY SERVER
            status: 'pending',
            order_ref: orderRef,
            order_source: 'api',               // ← marks as verified server-side order
            fingerprint: fingerprint ? sanitize(fingerprint, 64) : null,
            client_ip: serverIP,               // ← FROM SERVER HEADERS, not client
            client_country: serverCountry,     // ← FROM SERVER GEO LOOKUP
            client_city: serverCity            // ← FROM SERVER GEO LOOKUP
        };

        const result = await supabaseInsert('orders', orderData);
        const savedId = result?.[0]?.id || null;

        return res.status(200).json({
            success: true,
            order_ref: orderRef,
            id: savedId,
            total: serverTotal,
            products: validatedProducts
        });

    } catch (err) {
        console.error('create-order error:', err);
        return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
}
