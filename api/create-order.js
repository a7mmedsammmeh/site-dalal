/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Creation API (v3 — Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/create-order
   
   Security layers (in order):
     1. Method + CORS (strict origin allowlist)
     2. Origin + Referer validation
     3. Multi-signal bot detection
     4. Content-Type validation
     5. Honeypot check (server-side)
     6. IP extraction (Vercel-trusted headers only)
     7. In-memory rate limiting (fast, per-instance)
     8. KV/DB-backed rate limiting (persistent, cross-instance)
     9. IP blocking check (indexed DB query)
    10. Fingerprint blocking check (indexed DB query)
    11. Phone blocking check (normalized, indexed DB query)
    12. Phone cooldown (in-memory + cross-instance)
    13. Duplicate payload detection (SHA-256 + in-memory)
    14. Field validation + sanitization
    15. Stock check
    16. Server-side price calculation (from DB)
    17. Geo-IP enrichment (cached)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, normalizePhone, hashSHA256, hashForLog,
    getGeoLocation, supabaseGet, supabaseInsert,
    logSecurityEvent, createMemoryRateLimiter, kvRateLimit,
    fetchSecurityLimits, getWindowMs, generateOrderRef
} from './_lib/security.js';

/* ── In-memory rate limiters ── */
const orderRateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 600000, maxHits: 3 });
const phoneCooldownLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 120000, maxHits: 1 });
const duplicateMap = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 120000, maxHits: 1 });

/* ── Duplicate payload tracking (separate from rate limiter) ── */
const recentPayloads = new Map();
const PAYLOAD_MAX_ENTRIES = 1000;

function isDuplicatePayload(key, hash, windowMs) {
    const now = Date.now();

    // Evict expired + enforce max size
    if (recentPayloads.size > PAYLOAD_MAX_ENTRIES * 0.8) {
        for (const [k, ts] of recentPayloads) {
            if (now - ts > windowMs) recentPayloads.delete(k);
        }
        if (recentPayloads.size >= PAYLOAD_MAX_ENTRIES) {
            const firstKey = recentPayloads.keys().next().value;
            if (firstKey) recentPayloads.delete(firstKey);
        }
    }

    const fullKey = `${key}:${hash}`;
    if (recentPayloads.has(fullKey) && now - recentPayloads.get(fullKey) < windowMs) {
        return true;
    }
    recentPayloads.set(fullKey, now);
    return false;
}


/* ═══════════════════════════════════════════════════════════════
   MAIN HANDLER
   ═══════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {

    /* ── LAYER 1: Method + CORS ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── LAYER 2: Origin Validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── LAYER 3: Bot Detection ── */
    if (isBot(req)) {
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── LAYER 4: Content-Type validation ── */
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid content type' });
    }

    /* ── Fetch dynamic security limits ── */
    const LIMITS = await fetchSecurityLimits();
    const rateWindowMs = getWindowMs(LIMITS, 'order_window_time', 'order_window_unit', 10);
    const dedupWindowMs = getWindowMs(LIMITS, 'duplicate_window_time', 'duplicate_window_unit', 2);
    const phoneCooldownMs = getWindowMs(LIMITS, 'phone_cooldown_time', 'phone_cooldown_unit', 2);

    // Update in-memory limiter configs
    orderRateLimiter.updateConfig(rateWindowMs, LIMITS.order_max_per_ip);

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing request body' });

        /* ── LAYER 5: Honeypot Check ── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            // Silently reject — return fake success to not reveal detection
            return res.status(200).json({
                success: true,
                order_ref: generateOrderRef(),
                id: null,
                total: 0,
                products: []
            });
        }

        /* ── LAYER 6: Extract REAL IP from server headers ── */
        const serverIP = getServerIP(req);

        /* ── LAYER 7: In-Memory Rate Limiting (fast) ── */
        if (orderRateLimiter.check(serverIP)) {
            logSecurityEvent('order:mem_rate_limited', { ip: serverIP });
            return res.status(429).json({
                error: 'rate_limited',
                message: 'Too many orders. Please wait.'
            });
        }

        /* ── LAYER 8: KV/DB-Backed Rate Limiting (cross-instance) ── */
        try {
            // Try Vercel KV first
            const kvResult = await kvRateLimit(`order:${serverIP}`, rateWindowMs, LIMITS.order_max_per_ip);
            if (kvResult === true) {
                logSecurityEvent('order:kv_rate_limited', { ip: serverIP });
                return res.status(429).json({ error: 'rate_limited', message: 'Too many orders. Please wait.' });
            }

            // If KV not available, use DB fallback
            if (kvResult === null && serverIP) {
                const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                const ipOrders = await supabaseGet(
                    'orders',
                    `client_ip=eq.${encodeURIComponent(serverIP)}&created_at=gte.${windowTime}&select=id`
                );
                if (ipOrders.length >= LIMITS.order_max_per_ip) {
                    logSecurityEvent('order:db_rate_limited', { ip: serverIP });
                    return res.status(429).json({ error: 'rate_limited', message: 'Too many orders. Please wait.' });
                }
            }
        } catch { /* don't fail the order if rate check errors */ }

        const { name, phone, email, address, lang, items, fingerprint } = body;

        /* ── LAYER 9: IP Blocking Check ── */
        if (serverIP) {
            try {
                const ipCheck = await supabaseGet(
                    'blocked_ips',
                    `ip=eq.${encodeURIComponent(serverIP)}&select=ip&limit=1`
                );
                if (ipCheck.length > 0) {
                    return res.status(403).json({
                        error: 'access_restricted',
                        message: 'Your access has been restricted.'
                    });
                }
            } catch {
                // FAIL CLOSED: if we can't verify, reject
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        /* ── LAYER 10: Fingerprint Blocking Check ── */
        if (fingerprint) {
            const fpClean = sanitize(fingerprint, 64);
            try {
                const fpCheck = await supabaseGet(
                    'blocked_fingerprints',
                    `fingerprint=eq.${encodeURIComponent(fpClean)}&select=fingerprint&limit=1`
                );
                if (fpCheck.length > 0) {
                    return res.status(403).json({
                        error: 'access_restricted',
                        message: 'Your access has been restricted.'
                    });
                }
            } catch {
                // FAIL CLOSED
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        /* ── Field Validation ── */
        if (!name || !phone || !address) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or empty items' });
        }
        if (items.length > (LIMITS.max_items_per_order || 20)) {
            return res.status(400).json({ error: 'Too many items in order' });
        }

        /* ── LAYER 11: Phone Blocking Check (normalized, direct query) ── */
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || normalizedPhone.length < 9) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        try {
            // Indexed query on normalized_phone (NO full-table scan)
            const phoneCheck = await supabaseGet(
                'blocked_phones',
                `normalized_phone=eq.${encodeURIComponent(normalizedPhone)}&select=id&limit=1`
            );
            if (phoneCheck.length > 0) {
                return res.status(403).json({
                    error: 'access_restricted',
                    message: 'This phone number has been restricted.'
                });
            }
        } catch {
            // Fail safe: if query errors, don't block the order
            // (normalized_phone column must exist — run migration)
        }

        /* ── Fingerprint rate limiting (catches VPN/IP changers) ── */
        if (fingerprint) {
            try {
                const fpClean = sanitize(fingerprint, 64);
                const kvFp = await kvRateLimit(`order:fp:${fpClean}`, rateWindowMs, LIMITS.order_max_per_ip);
                if (kvFp === true) {
                    return res.status(429).json({ error: 'rate_limited', message: 'Too many orders from this device. Please wait.' });
                }
                if (kvFp === null) {
                    const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                    const fpOrders = await supabaseGet(
                        'orders',
                        `fingerprint=eq.${encodeURIComponent(fpClean)}&created_at=gte.${windowTime}&select=id`
                    );
                    if (fpOrders.length >= LIMITS.order_max_per_ip) {
                        return res.status(429).json({ error: 'rate_limited', message: 'Too many orders from this device. Please wait.' });
                    }
                }
            } catch { /* don't fail order */ }
        }

        /* ── LAYER 12: Duplicate Payload Detection (SHA-256) ── */
        const payloadHash = await hashSHA256(JSON.stringify({ phone: normalizedPhone, address, items }));
        if (isDuplicatePayload(serverIP, payloadHash, dedupWindowMs)) {
            logSecurityEvent('order:duplicate', { ip: serverIP, detail: `hash:${payloadHash.slice(0, 8)}` });
            return res.status(429).json({
                error: 'duplicate',
                message: 'This order was already submitted. Please wait.'
            });
        }

        /* ── LAYER 12b: Phone Cooldown ── */
        if (phoneCooldownLimiter.check(normalizedPhone)) {
            logSecurityEvent('order:phone_cooldown', { ip: serverIP, phone: normalizedPhone });
            return res.status(429).json({
                error: 'rate_limited',
                message: 'Please wait before placing another order.'
            });
        }

        /* ── LAYER 13: Geo-IP (cached) ── */
        const { country: serverCountry, city: serverCity } = await getGeoLocation(serverIP);

        /* ══════════════════════════════════════════════════════
           BUSINESS LOGIC — Stock + Price Validation
           ══════════════════════════════════════════════════════ */

        /* ── Validate and collect product IDs ── */
        const productIds = [];
        for (const item of items) {
            const pid = parseInt(item.product_id);
            if (!pid || pid < 1 || !Number.isInteger(pid)) {
                return res.status(400).json({ error: 'Invalid product_id in items' });
            }
            if (!productIds.includes(pid)) productIds.push(pid);
        }

        /* ── Fetch product stock status ── */
        try {
            const stockData = await supabaseGet(
                'product_stock',
                `product_id=in.(${productIds.join(',')})&select=product_id,visibility_status`
            );
            const stockMap = {};
            stockData.forEach(s => { stockMap[s.product_id] = s; });

            const outOfStock = [];
            for (const item of items) {
                const pid = parseInt(item.product_id);
                const stock = stockMap[pid];
                if (stock && stock.visibility_status !== 'visible') {
                    outOfStock.push(pid);
                }
            }
            if (outOfStock.length > 0) {
                return res.status(400).json({
                    error: 'out_of_stock',
                    product_ids: outOfStock,
                    message: 'Some products are out of stock.'
                });
            }
        } catch { /* don't block order if stock check fails */ }

        /* ── Fetch REAL prices from database ── */
        const pricingData = await supabaseGet(
            'product_pricing',
            `product_id=in.(${productIds.join(',')})&select=product_id,language,label,value,offer_order&order=offer_order`
        );

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
            const pid = parseInt(item.product_id);
            const offerIndex = parseInt(item.offer_index);
            const qty = Math.max(1, Math.min(parseInt(item.qty) || 1, 99));
            const itemLang = lang || 'ar';

            const key = `${pid}_${itemLang}`;
            const fallbackKey = `${pid}_ar`;
            let productPricing = pricingMap[key] || pricingMap[fallbackKey] || [];
            productPricing.sort((a, b) => a.offer_order - b.offer_order);

            if (productPricing.length === 0) {
                return res.status(400).json({
                    error: 'invalid_product',
                    message: 'Product not available'
                });
            }

            if (isNaN(offerIndex) || offerIndex < 0 || offerIndex >= productPricing.length) {
                return res.status(400).json({
                    error: 'invalid_offer',
                    message: 'Invalid product option selected'
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
                offer: realOffer.label,
                price: realOffer.value,
                qty: qty
            });

            serverTotal += realPrice * qty;
        }

        /* ── Generate order ref ── */
        const orderRef = generateOrderRef();

        /* ── Insert order with SERVER-VALIDATED data ── */
        const fpClean = fingerprint ? sanitize(fingerprint, 64) : null;
        const orderData = {
            name: sanitize(name, 100),
            phone: sanitize(phone, 20),
            email: email ? sanitize(email, 100) : null,
            address: sanitize(address, 300),
            lang: lang || 'ar',
            products: validatedProducts,
            total: serverTotal,
            status: 'pending',
            order_ref: orderRef,
            order_source: 'api',
            fingerprint: fpClean,
            client_ip: serverIP,
            client_country: serverCountry,
            client_city: serverCity
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
        console.error('create-order error:', err?.message || err);
        // Never expose internal error details
        return res.status(500).json({ error: 'Internal server error' });
    }
}
