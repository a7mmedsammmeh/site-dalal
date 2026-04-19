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

export default async function handler(req, res) {
    /* CORS */
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const body = req.body;
        if (!body) return res.status(400).json({ error: 'Missing body' });

        const { name, phone, email, address, lang, items, client_ip, client_country, client_city, fingerprint } = body;

        /* ── Validate required fields ── */
        if (!name || !phone || !address) {
            return res.status(400).json({ error: 'Missing required fields: name, phone, address' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'Missing or empty items array' });
        }

        /* ── Check phone blocking ── */
        try {
            const phoneCheck = await supabaseGet(
                'blocked_phones',
                `phone=eq.${encodeURIComponent(phone)}&select=phone,reason&limit=1`
            );
            if (phoneCheck.length > 0) {
                return res.status(403).json({
                    error: 'phone_blocked',
                    message: 'This phone number is blocked from placing orders.'
                });
            }
        } catch (e) { /* don't block order if check fails */ }

        /* ── Server-Side Rate Limiting (by IP + Fingerprint) ── */
        const RATE_WINDOW_MIN = 15;
        const MAX_PER_IP = 5;
        const MAX_PER_FP = 5;
        const windowTime = new Date(Date.now() - RATE_WINDOW_MIN * 60 * 1000).toISOString();

        try {
            // Rate limit by IP
            if (client_ip) {
                const ipOrders = await supabaseGet(
                    'orders',
                    `client_ip=eq.${encodeURIComponent(client_ip)}&created_at=gte.${windowTime}&select=id`
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
            const qty = Math.max(1, parseInt(item.qty) || 1);
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
                code: productInfo.code || item.code || '',
                name: isAr ? (productInfo.name_ar || '') : (productInfo.name_en || productInfo.name_ar || ''),
                size: (item.size || '').substring(0, 50),     // limit length
                color: (item.color || '').substring(0, 50),
                notes: (item.notes || '').substring(0, 200),
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
            name: name.substring(0, 100),
            phone: phone.substring(0, 20),
            email: email || null,
            address: address.substring(0, 300),
            lang: lang || 'ar',
            products: validatedProducts,
            total: serverTotal,           // ← CALCULATED BY SERVER
            status: 'pending',
            order_ref: orderRef,
            order_source: 'api',          // ← marks as verified server-side order
            fingerprint: fingerprint || null,
            client_ip: client_ip || null,
            client_country: client_country || null,
            client_city: client_city || null
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
