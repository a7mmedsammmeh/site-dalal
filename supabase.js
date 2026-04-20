/* ═══════════════════════════════════════════════════════════════
   DALAL — Supabase Client (PUBLIC)
   ─────────────────────────────────────────────────────────────
   This file contains ONLY functions needed by public-facing pages.
   All admin/destructive operations live in supabase-admin.js.
   ═══════════════════════════════════════════════════════════════ */

const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

let _supabase = null;

async function getSupabase() {
    if (_supabase) return _supabase;
    if (!window.supabase) {
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    }
    _supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _supabase;
}

/* ─── Orders (Public) ─── */

async function insertOrder(orderData) {
    // ══════════════════════════════════════════════════════════
    // ⛔ BLOCKED: Direct insert is disabled for security.
    // All orders MUST go through /api/create-order (server-side)
    // which validates prices from the database.
    // ══════════════════════════════════════════════════════════
    throw new Error('Direct order insertion is disabled. Use /api/create-order instead.');
}

/**
 * Fetch a single order by its reference code (for tracking page).
 * Uses RPC function — anon has NO direct SELECT on orders table.
 * The RPC returns ONLY: order_ref, status, products, total, created_at, cancel_reason
 */
async function fetchOrderByRef(ref) {
    const db = await getSupabase();
    const { data, error } = await db.rpc('get_order_by_ref', { p_ref: ref });
    if (error) throw error;
    if (!data || !data.length) throw new Error('Order not found');
    return data[0];
}

/* ─── Reviews (Public — read-only, visible only via RLS) ─── */

async function fetchReviews(limit = 20) {
    const db = await getSupabase();
    const { data, error } = await db
        .from('reviews')
        .select('id, name, rating, comment, created_at, is_pinned')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}

/* ─── Visitors (BLOCKED — server-side only) ─── */

async function insertVisitor(data) {
    // ══════════════════════════════════════════════════════════
    // ⛔ BLOCKED: Direct insert is disabled for security.
    // All visitor tracking MUST go through /api/track-visitor
    // (server-side) which validates origin, rate-limits, and
    // extracts IP from headers — not from client input.
    // ══════════════════════════════════════════════════════════
    throw new Error('Direct visitor insertion is disabled. Use /api/track-visitor instead.');
}

/* ─── Blocking Checks (via secure RPC — no direct table access) ─── */

async function isIPBlocked(ip) {
    if (!ip) return false;
    try {
        const db = await getSupabase();
        const { data, error } = await db.rpc('is_ip_blocked', { p_ip: ip });
        if (error) return false;
        return data && data.length > 0;
    } catch { return false; }
}

async function isIPBlockedWithReason(ip) {
    if (!ip) return { blocked: false, reason: null };
    try {
        const db = await getSupabase();
        const { data, error } = await db.rpc('is_ip_blocked', { p_ip: ip });
        if (error || !data || !data.length) return { blocked: false, reason: null };
        return { blocked: true, reason: data[0].reason || null };
    } catch { return { blocked: false, reason: null }; }
}

async function isPhoneBlocked(phone) {
    if (!phone) return { blocked: false, reason: null };
    try {
        const db = await getSupabase();
        const { data, error } = await db.rpc('is_phone_blocked', { p_phone: phone });
        if (error || !data || !data.length) return { blocked: false, reason: null };
        return { blocked: true, reason: data[0].reason || null };
    } catch { return { blocked: false, reason: null }; }
}

async function isFingerprintBlocked(fp) {
    if (!fp) return { blocked: false, reason: null };
    try {
        const db = await getSupabase();
        const { data, error } = await db.rpc('is_fingerprint_blocked', { p_fp: fp });
        if (error || !data || !data.length) return { blocked: false, reason: null };
        return { blocked: true, reason: data[0].reason || null };
    } catch { return { blocked: false, reason: null }; }
}

/* ─── Product Stock (Public — read-only) ─── */

async function getProductStock(productId) {
    try {
        const db = await getSupabase();
        const { data, error } = await db
            .from('product_stock')
            .select('in_stock, visibility_status')
            .eq('product_id', productId)
            .limit(1);
        if (error) return { in_stock: true, visibility_status: 'visible' };
        if (!data || !data.length) return { in_stock: true, visibility_status: 'visible' };
        return {
            in_stock: data[0].in_stock,
            visibility_status: data[0].visibility_status || 'visible'
        };
    } catch { return { in_stock: true, visibility_status: 'visible' }; }
}

/* ─── Fetch ALL product stock (Public — for products-data.js) ─── */
async function fetchAllProductStock() {
    try {
        const db = await getSupabase();
        const { data, error } = await db
            .from('product_stock')
            .select('product_id, in_stock, visibility_status');
        if (error) return [];
        return data || [];
    } catch { return []; }
}

/* ─── Products (Public — read-only for product catalog) ─── */

async function fetchAllProducts() {
    const db = await getSupabase();
    const { data: products, error: productsError } = await db
        .from('products')
        .select('id, slug, code, name_ar, name_en, description_ar, description_en, main_image_url, featured, sizes, display_order')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
    
    if (productsError) throw productsError;
    if (!products || !products.length) return [];

    // Fetch images and pricing for all products
    const productIds = products.map(p => p.id);
    
    const [imagesResult, pricingResult] = await Promise.all([
        db.from('product_images').select('product_id, image_url, image_order').in('product_id', productIds).order('image_order'),
        db.from('product_pricing').select('product_id, language, label, value, offer_order').in('product_id', productIds).order('offer_order')
    ]);

    const images = imagesResult.data || [];
    const pricing = pricingResult.data || [];

    // Group by product_id
    const imagesByProduct = {};
    const pricingByProduct = {};

    images.forEach(img => {
        if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
        imagesByProduct[img.product_id].push(img);
    });

    pricing.forEach(p => {
        if (!pricingByProduct[p.product_id]) pricingByProduct[p.product_id] = { ar: [], en: [] };
        pricingByProduct[p.product_id][p.language].push({ label: p.label, value: p.value });
    });

    // Transform to match products.json format
    return products.map(p => ({
        id: p.id,
        slug: p.slug,
        code: p.code,
        name: { ar: p.name_ar, en: p.name_en },
        description: { ar: p.description_ar || '', en: p.description_en || '' },
        main_image_url: p.main_image_url,
        // For backward compatibility with old code
        folder: p.main_image_url ? p.main_image_url.substring(0, p.main_image_url.lastIndexOf('/')) : '',
        main: p.main_image_url ? p.main_image_url.substring(p.main_image_url.lastIndexOf('/') + 1) : 'pic.png',
        gallery: (imagesByProduct[p.id] || []).map(img => img.image_url),
        featured: p.featured,
        sizes: p.sizes || [],
        pricing: pricingByProduct[p.id] || { ar: [], en: [] }
    }));
}
