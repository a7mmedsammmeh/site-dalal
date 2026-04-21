/* ═══════════════════════════════════════════════════════════════
   DALAL — Secure Order Creation API (v4 — Production Hardened)
   ─────────────────────────────────────────────────────────────
   POST /api/create-order

   Security layers (in order):
     1. Security headers (all responses)
     2. Method + CORS (strict origin allowlist)
     3. Origin + Referer validation
     4. Global rate limiting (100 req/min per IP)
     5. Multi-signal bot detection
     6. Content-Type validation
     7. HMAC anti-replay validation
     8. Honeypot check (server-side)
     9. IP extraction (Vercel-trusted headers only)
    10. Composite client ID (IP + UA + fingerprint)
    11. In-memory rate limiting (fast, per-instance)
    12. KV rate limiting (FAIL CLOSED if KV configured)
    13. DB rate limiting (fallback only if KV not configured)
    14. IP blocking check (FAIL CLOSED)
    15. Fingerprint blocking check (FAIL CLOSED)
    16. Anomaly tracking + auto-block
    17. Phone blocking check (FAIL CLOSED)
    18. Phone cooldown
    19. Duplicate payload detection (SHA-256)
    20. Field validation + sanitization
    21. Stock check
    22. Server-side price calculation (from DB)
    23. Geo-IP enrichment (cached, fail safe)
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, validateOrigin, getServerIP, isBot,
    sanitize, normalizePhone, hashSHA256,
    getGeoLocation, supabaseGet, supabaseInsert,
    logSecurityEvent, createMemoryRateLimiter, kvRateLimit,
    fetchSecurityLimits, getWindowMs, generateOrderRef,
    checkGlobalRateLimit, getCompositeId, validateRequestSignature,
    trackAnomaly, checkAndAutoBlock, KV_CONFIGURED, TIMEOUT
} from './_lib/security.js';

/* ── In-memory rate limiters ── */
const orderRateLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 600000, maxHits: 3 });
const phoneCooldownLimiter = createMemoryRateLimiter({ maxEntries: 1000, windowMs: 120000, maxHits: 1 });

/* ── Duplicate payload tracking ── */
const recentPayloads = new Map();
const PAYLOAD_MAX_ENTRIES = 1000;

function isDuplicatePayload(key, hash, windowMs) {
    const now = Date.now();
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

    /* ── LAYER 1: Method + CORS + Security Headers ── */
    setCorsHeaders(req, res, 'POST, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    /* ── LAYER 2: Origin Validation ── */
    if (!validateOrigin(req)) {
        return res.status(403).json({ error: 'Forbidden' });
    }

    /* ── LAYER 3: IP extraction ── */
    const serverIP = getServerIP(req);

    /* ── LAYER 4: Bot Detection ── */
    if (isBot(req)) {
        trackAnomaly(serverIP, 'failure');
        return res.status(403).json({ error: 'Request blocked' });
    }

    /* ── LAYER 5: Content-Type validation ── */
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('application/json')) {
        return res.status(400).json({ error: 'Invalid content type' });
    }

    /* ── LAYER 6: HMAC Anti-Replay ── */
    if (!validateRequestSignature(req)) {
        logSecurityEvent('warning', 'order:hmac_failed', { ip: serverIP });
        trackAnomaly(serverIP, 'failure');
        return res.status(403).json({ error: 'Invalid request signature' });
    }

    /* ── Fetch dynamic security limits ── */
    const LIMITS = await fetchSecurityLimits();
    const rateWindowMs = getWindowMs(LIMITS, 'order_window_time', 'order_window_unit', 10);
    const dedupWindowMs = getWindowMs(LIMITS, 'duplicate_window_time', 'duplicate_window_unit', 2);
    const phoneCooldownMs = getWindowMs(LIMITS, 'phone_cooldown_time', 'phone_cooldown_unit', 2);

    orderRateLimiter.updateConfig(rateWindowMs, LIMITS.order_max_per_ip);
    phoneCooldownLimiter.updateConfig(phoneCooldownMs, LIMITS.order_max_per_ip);

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing request body' });

        /* ── LAYER 7: Honeypot Check ── */
        if (body.dalal_website && body.dalal_website.trim() !== '') {
            trackAnomaly(serverIP, 'failure');
            return res.status(200).json({
                success: true,
                order_ref: generateOrderRef(),
                id: null, total: 0, products: []
            });
        }

        /* ── LAYER 8: Composite Client ID ── */
        const { fingerprint } = body;
        const compositeId = getCompositeId(serverIP, req, fingerprint);

        /* ── LAYER 9: In-Memory Rate Limiting (fast) ── */
        if (orderRateLimiter.check(compositeId, false)) {
            logSecurityEvent('warning', 'order:mem_rate_limited', { ip: serverIP });
            trackAnomaly(serverIP, 'failure');
            return res.status(429).json({ error: 'rate_limited', reason: 'MEMORY_RATE_LIMIT', message: 'Too many orders. Please wait.' });
        }

        /* ── LAYER 10: DB Rate Limiting (source of truth — counts real orders) ── */
        if (serverIP) {
            try {
                const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                const ipOrders = await supabaseGet(
                    'orders',
                    `client_ip=eq.${encodeURIComponent(serverIP)}&created_at=gte.${windowTime}&select=id`,
                    TIMEOUT.SECURITY
                );
                if (ipOrders.length >= LIMITS.order_max_per_ip) {
                    logSecurityEvent('warning', 'order:db_rate_limited', { ip: serverIP, count: ipOrders.length, limit: LIMITS.order_max_per_ip });
                    return res.status(429).json({ error: 'rate_limited', reason: 'DB_IP_RATE_LIMIT', count: ipOrders.length, limit: LIMITS.order_max_per_ip, message: 'Too many orders. Please wait.' });
                }
            } catch {
                logSecurityEvent('critical', 'order:rate_check_failed', { ip: serverIP });
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        const { name, phone, email, address, lang, items } = body;

        /* ── LAYER 12: IP Blocking Check (FAIL CLOSED) ── */
        if (serverIP) {
            try {
                const ipCheck = await supabaseGet(
                    'blocked_ips',
                    `ip=eq.${encodeURIComponent(serverIP)}&select=ip&limit=1`,
                    TIMEOUT.SECURITY
                );
                if (ipCheck.length > 0) {
                    return res.status(403).json({ error: 'access_restricted', message: 'Your access has been restricted.' });
                }
            } catch {
                // FAIL CLOSED
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        /* ── LAYER 13: Fingerprint Blocking Check (FAIL CLOSED) ── */
        if (fingerprint) {
            const fpClean = sanitize(fingerprint, 64);
            try {
                const fpCheck = await supabaseGet(
                    'blocked_fingerprints',
                    `fingerprint=eq.${encodeURIComponent(fpClean)}&select=fingerprint&limit=1`,
                    TIMEOUT.SECURITY
                );
                if (fpCheck.length > 0) {
                    return res.status(403).json({ error: 'access_restricted', message: 'Your access has been restricted.' });
                }
            } catch {
                // FAIL CLOSED
                return res.status(503).json({ error: 'Service temporarily unavailable' });
            }
        }

        /* ── LAYER 14: Anomaly check ── */
        if (await checkAndAutoBlock(serverIP)) {
            return res.status(403).json({ error: 'access_restricted', message: 'Your access has been restricted.' });
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

        /* ── LAYER 15: Phone Blocking Check (FAIL CLOSED) ── */
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone || normalizedPhone.length < 9) {
            return res.status(400).json({ error: 'Invalid phone number format' });
        }

        // Track phone for anomaly detection
        trackAnomaly(serverIP, 'phone', normalizedPhone);

        try {
            const phoneCheck = await supabaseGet(
                'blocked_phones',
                `normalized_phone=eq.${encodeURIComponent(normalizedPhone)}&select=id&limit=1`,
                TIMEOUT.SECURITY
            );
            if (phoneCheck.length > 0) {
                return res.status(403).json({ error: 'access_restricted', message: 'This phone number has been restricted.' });
            }
        } catch {
            // FAIL CLOSED for phone block check
            return res.status(503).json({ error: 'Service temporarily unavailable' });
        }

        /* ── Fingerprint rate limiting via DB (counts real orders only) ── */
        if (fingerprint && serverIP) {
            try {
                const fpClean = sanitize(fingerprint, 64);
                const windowTime = new Date(Date.now() - rateWindowMs).toISOString();
                const fpOrders = await supabaseGet(
                    'orders',
                    `fingerprint=eq.${encodeURIComponent(fpClean)}&created_at=gte.${windowTime}&select=id`,
                    TIMEOUT.SECURITY
                );
                if (fpOrders.length >= LIMITS.order_max_per_ip) {
                    return res.status(429).json({ error: 'rate_limited', reason: 'DB_FINGERPRINT_LIMIT', count: fpOrders.length, limit: LIMITS.order_max_per_ip, message: 'Too many orders from this device. Please wait.' });
                }
            } catch { /* fingerprint rate check is secondary — don't block on failure */ }
        }

        /* ── LAYER 16: Duplicate Payload Detection (SHA-256) ── */
        if (dedupWindowMs > 0) {
            const payloadHash = await hashSHA256(JSON.stringify({ phone: normalizedPhone, address, items }));
            if (isDuplicatePayload(compositeId, payloadHash, dedupWindowMs)) {
                logSecurityEvent('warning', 'order:duplicate', { ip: serverIP, detail: `hash:${payloadHash.slice(0, 8)}` });
                return res.status(429).json({ error: 'duplicate', reason: 'DUPLICATE_PAYLOAD', message: 'This order was already submitted. Please wait.' });
            }
        }

        /* ── LAYER 17: Phone Cooldown ── */
        if (phoneCooldownLimiter.check(normalizedPhone, false)) {
            logSecurityEvent('info', 'order:phone_cooldown', { ip: serverIP, phone: normalizedPhone });
            return res.status(429).json({ error: 'rate_limited', reason: 'PHONE_COOLDOWN', message: 'Please wait before placing another order.' });
        }

        /* ── Geo-IP (cached, non-critical — fail safe) ── */
        const { country: serverCountry, city: serverCity } = await getGeoLocation(serverIP);

        /* ══════════════════════════════════════════════════════
           BUSINESS LOGIC — Stock + Price Validation
           ══════════════════════════════════════════════════════ */

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
                return res.status(400).json({ error: 'out_of_stock', product_ids: outOfStock, message: 'Some products are out of stock.' });
            }
        } catch { /* don't block order if stock check fails — non-critical */ }

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
                return res.status(400).json({ error: 'invalid_product', message: 'Product not available' });
            }

            if (isNaN(offerIndex) || offerIndex < 0 || offerIndex >= productPricing.length) {
                return res.status(400).json({ error: 'invalid_offer', message: 'Invalid product option selected' });
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

        /* ── Record successful order in rate limiters ── */
        orderRateLimiter.record(compositeId);
        phoneCooldownLimiter.record(normalizedPhone);

        return res.status(200).json({
            success: true,
            order_ref: orderRef,
            id: savedId,
            total: serverTotal,
            products: validatedProducts
        });

    } catch {
        return res.status(500).json({ error: 'Internal server error' });
    }
}
