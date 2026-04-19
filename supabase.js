/* ═══════════════════════════════════════════════════════════════
   DALAL — Supabase Client
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

async function insertOrder(orderData) {
    const db = await getSupabase();
    const { data, error } = await db.from('orders').insert([orderData]).select();
    if (error) throw error;
    return data;
}

async function fetchOrders() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('orders')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function updateOrderStatus(id, status, cancelReason = null) {
    const db = await getSupabase();
    const updateData = { status };
    if (cancelReason !== null) updateData.cancel_reason = cancelReason;
    
    const { error } = await db
        .from('orders')
        .update(updateData)
        .eq('id', id);
    if (error) throw error;
}

async function deleteOrder(id) {
    const db = await getSupabase();
    const { error } = await db
        .from('orders')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

async function fetchOrderByRef(ref) {
    const db = await getSupabase();
    const { data, error } = await db
        .from('orders')
        .select('order_ref, status, products, total, created_at, cancel_reason')
        .eq('order_ref', ref)
        .limit(1)
        .single();
    if (error) throw error;
    return data;
}

async function deleteAllOrders() {
    const db = await getSupabase();
    const { error } = await db
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows
    if (error) throw error;
}

async function fetchReviews(limit = 20) {
    const db = await getSupabase();
    const { data, error } = await db
        .from('reviews')
        .select('*')
        .eq('is_visible', true)
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}

async function fetchAllReviews() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('reviews')
        .select('*')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function deleteReview(id) {
    const db = await getSupabase();
    const { error } = await db.from('reviews').delete().eq('id', id);
    if (error) throw error;
}

async function toggleReviewVisibility(id, visible) {
    const db = await getSupabase();
    const { error } = await db.from('reviews').update({ is_visible: visible }).eq('id', id);
    if (error) throw error;
}

async function toggleReviewPin(id, pinned) {
    const db = await getSupabase();
    const { error } = await db.from('reviews').update({ is_pinned: pinned }).eq('id', id);
    if (error) throw error;
}

/* ─── Visitors ─── */
async function insertVisitor(data) {
    const db = await getSupabase();
    const { error } = await db.from('visitors').insert([data]);
    if (error) console.warn('visitor insert:', error.message);
}

async function fetchVisitors() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('visitors')
        .select('*')
        .order('visited_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function deleteVisitor(id) {
    const db = await getSupabase();
    const { error } = await db.from('visitors').delete().eq('id', id);
    if (error) throw error;
}

async function deleteAllVisitors() {
    const db = await getSupabase();
    const { error } = await db
        .from('visitors')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}

/* ─── Blocked IPs ─── */
async function fetchBlockedIPs() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_ips')
        .select('*')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockIP(ip, reason = null) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_ips').insert([{
        ip,
        reason,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockIP(id) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_ips').delete().eq('id', id);
    if (error) throw error;
}

async function unblockIPFull(ip) {
    // Unblock IP + all associated fingerprints
    const db = await getSupabase();

    // 1. Delete from blocked_ips by IP value
    await db.from('blocked_ips').delete().eq('ip', ip);

    // 2. Delete fingerprints that reference this IP
    await db.from('blocked_fingerprints').delete().eq('blocked_ip_ref', ip);
}

async function isIPBlocked(ip) {
    if (!ip) return false;
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_ips')
        .select('ip')
        .eq('ip', ip)
        .limit(1);
    if (error) return false;
    return data && data.length > 0;
}

async function isIPBlockedWithReason(ip) {
    if (!ip) return { blocked: false, reason: null };
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_ips')
        .select('ip, reason')
        .eq('ip', ip)
        .limit(1);
    if (error || !data || !data.length) return { blocked: false, reason: null };
    return { blocked: true, reason: data[0].reason || null };
}

/* ─── Blocked Phones ─── */
async function fetchBlockedPhones() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_phones')
        .select('*')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockPhone(phone, reason = null) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_phones').insert([{
        phone,
        reason,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockPhone(id) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_phones').delete().eq('id', id);
    if (error) throw error;
}

async function isPhoneBlocked(phone) {
    if (!phone) return { blocked: false, reason: null };
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_phones')
        .select('phone, reason')
        .eq('phone', phone)
        .limit(1);
    if (error || !data || !data.length) return { blocked: false, reason: null };
    return { blocked: true, reason: data[0].reason || null };
}

/* ─── Blocked Fingerprints ─── */
async function fetchBlockedFingerprints() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_fingerprints')
        .select('*')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockFingerprint(fingerprint, reason = null, blocked_ip_ref = null) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_fingerprints').insert([{
        fingerprint,
        reason,
        blocked_ip_ref,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockFingerprint(id) {
    const db = await getSupabase();
    const { error } = await db.from('blocked_fingerprints').delete().eq('id', id);
    if (error) throw error;
}

async function isFingerprintBlocked(fp) {
    if (!fp) return { blocked: false, reason: null };
    const db = await getSupabase();
    const { data, error } = await db
        .from('blocked_fingerprints')
        .select('fingerprint, reason')
        .eq('fingerprint', fp)
        .limit(1);
    if (error || !data || !data.length) return { blocked: false, reason: null };
    return { blocked: true, reason: data[0].reason || null };
}

/* ─── Product Stock ─── */
async function fetchProductStock() {
    const db = await getSupabase();
    const { data, error } = await db
        .from('product_stock')
        .select('*');
    if (error) throw error;
    return data || [];
}

async function updateProductStock(productId, inStock, visibilityStatus = null) {
    const db = await getSupabase();
    // Try to update first
    const { data: existing } = await db
        .from('product_stock')
        .select('id')
        .eq('product_id', productId)
        .limit(1);
    
    const updateData = { 
        in_stock: inStock, 
        updated_at: new Date().toISOString() 
    };
    
    // If visibilityStatus is provided, update it
    if (visibilityStatus !== null) {
        updateData.visibility_status = visibilityStatus;
    }
    
    if (existing && existing.length > 0) {
        // Update existing
        const { error } = await db
            .from('product_stock')
            .update(updateData)
            .eq('product_id', productId);
        if (error) throw error;
    } else {
        // Insert new
        const insertData = { 
            product_id: productId, 
            in_stock: inStock 
        };
        if (visibilityStatus !== null) {
            insertData.visibility_status = visibilityStatus;
        }
        const { error } = await db
            .from('product_stock')
            .insert([insertData]);
        if (error) throw error;
    }
}

async function getProductStock(productId) {
    const db = await getSupabase();
    const { data, error } = await db
        .from('product_stock')
        .select('in_stock, visibility_status')
        .eq('product_id', productId)
        .limit(1);
    if (error) return { in_stock: true, visibility_status: 'visible' }; // Default to in stock on error
    if (!data || !data.length) return { in_stock: true, visibility_status: 'visible' }; // Default to in stock if not found
    return {
        in_stock: data[0].in_stock,
        visibility_status: data[0].visibility_status || 'visible'
    };
}

/* ─── Activity Logs ─── */
async function logActivity(actionType, actionDescription, entityType = null, entityId = null, details = null) {
    try {
        const db = await getSupabase();
        // Get IP address
        let ipAddress = null;
        try {
            const ipRes = await fetch('/api/get-ip', { signal: AbortSignal.timeout(3000) });
            if (ipRes.ok) {
                const ipData = await ipRes.json();
                ipAddress = ipData.ip || null;
            }
        } catch (e) { /* silent */ }
        
        const { error } = await db.from('activity_logs').insert([{
            action_type: actionType,
            action_description: actionDescription,
            entity_type: entityType,
            entity_id: entityId ? String(entityId) : null,
            details: details ? JSON.parse(JSON.stringify(details)) : null,
            ip_address: ipAddress,
            created_at: new Date().toISOString()
        }]);
        if (error) console.warn('Activity log error:', error);
    } catch (e) {
        console.warn('Activity log failed:', e);
    }
}

async function fetchActivityLogs(limit = 100, actionType = null) {
    const db = await getSupabase();
    let query = db
        .from('activity_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (actionType) {
        query = query.eq('action_type', actionType);
    }
    
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
}

async function deleteActivityLog(id) {
    const db = await getSupabase();
    const { error } = await db.from('activity_logs').delete().eq('id', id);
    if (error) throw error;
}

async function clearActivityLogs() {
    const db = await getSupabase();
    const { error } = await db
        .from('activity_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}

/* ─── Products Management ─── */
async function fetchAllProducts() {
    const db = await getSupabase();
    const { data: products, error: productsError } = await db
        .from('products')
        .select('*')
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('id', { ascending: true });
    
    if (productsError) throw productsError;
    if (!products || !products.length) return [];

    // Fetch images and pricing for all products
    const productIds = products.map(p => p.id);
    
    const [imagesResult, pricingResult] = await Promise.all([
        db.from('product_images').select('*').in('product_id', productIds).order('image_order'),
        db.from('product_pricing').select('*').in('product_id', productIds).order('offer_order')
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

async function insertProduct(productData) {
    const db = await getSupabase();
    const { data, error } = await db.from('products').insert([{
        slug: productData.slug,
        code: productData.code,
        name_ar: productData.name_ar,
        name_en: productData.name_en,
        description_ar: productData.description_ar,
        description_en: productData.description_en,
        main_image_url: productData.main_image_url,
        featured: productData.featured || false,
        sizes: productData.sizes || []
    }]).select();
    if (error) throw error;
    return data[0];
}

async function updateProduct(id, productData) {
    const db = await getSupabase();
    const { error } = await db.from('products').update({
        slug: productData.slug,
        code: productData.code,
        name_ar: productData.name_ar,
        name_en: productData.name_en,
        description_ar: productData.description_ar,
        description_en: productData.description_en,
        main_image_url: productData.main_image_url,
        featured: productData.featured,
        sizes: productData.sizes,
        display_order: productData.display_order !== undefined ? productData.display_order : null,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
}

async function updateProductOrder(id, displayOrder) {
    const db = await getSupabase();
    const { error } = await db.from('products').update({
        display_order: displayOrder,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
}

async function deleteProduct(id) {
    const db = await getSupabase();
    
    try {
        // Get product slug first (needed for storage deletion)
        const { data: product, error: fetchError } = await db
            .from('products')
            .select('slug')
            .eq('id', id)
            .single();

        if (fetchError) console.warn('Could not fetch product slug:', fetchError);
        const slug = product?.slug;

        // 1. Delete product images records
        const { error: imagesError } = await db.from('product_images').delete().eq('product_id', id);
        if (imagesError) console.warn('Error deleting product images:', imagesError);
        
        // 2. Delete product pricing
        const { error: pricingError } = await db.from('product_pricing').delete().eq('product_id', id);
        if (pricingError) console.warn('Error deleting product pricing:', pricingError);
        
        // 3. Delete product stock
        const { error: stockError } = await db.from('product_stock').delete().eq('product_id', id);
        if (stockError) console.warn('Error deleting product stock:', stockError);
        
        // 4. Delete product reviews (if exists)
        const { error: reviewsError } = await db.from('product_reviews').delete().eq('product_id', id);
        if (reviewsError) console.warn('Error deleting product reviews:', reviewsError);
        
        // 5. Delete storage files (bucket folder)
        if (slug) await deleteProductStorageFolder(slug);
        
        // 6. Finally delete the main product
        const { error: productError } = await db.from('products').delete().eq('id', id);
        if (productError) throw productError;
        
        console.log(`✅ Product ${id} and all related data deleted successfully`);
        
    } catch (error) {
        console.error('Error in deleteProduct:', error);
        throw error;
    }
}

async function insertProductImage(productId, imageUrl, order) {
    const db = await getSupabase();
    const { error } = await db.from('product_images').insert([{
        product_id: productId,
        image_url: imageUrl,
        image_order: order
    }]);
    if (error) throw error;
}

async function deleteProductImages(productId) {
    const db = await getSupabase();
    const { error } = await db.from('product_images').delete().eq('product_id', productId);
    if (error) throw error;
}

async function deleteProductImage(imageId) {
    const db = await getSupabase();
    const { error } = await db.from('product_images').delete().eq('id', imageId);
    if (error) throw error;
}

async function insertProductPricing(productId, language, offers) {
    const db = await getSupabase();
    const rows = offers.map((offer, index) => ({
        product_id: productId,
        language: language,
        offer_order: index + 1,
        label: offer.label,
        value: offer.value
    }));
    const { error } = await db.from('product_pricing').insert(rows);
    if (error) throw error;
}

async function deleteProductPricing(productId) {
    const db = await getSupabase();
    const { error } = await db.from('product_pricing').delete().eq('product_id', productId);
    if (error) throw error;
}

async function uploadProductImage(file, fileName) {
    const db = await getSupabase();
    const { data, error } = await db.storage
        .from('products')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });
    if (error) throw error;
    
    // Get public URL
    const { data: urlData } = db.storage.from('products').getPublicUrl(fileName);
    return urlData.publicUrl;
}

async function deleteProductStorageFolder(slug) {
    if (!slug) return;
    const db = await getSupabase();

    try {
        // List all files in the product's folder
        const { data: files, error: listError } = await db.storage
            .from('products')
            .list(slug);

        if (listError) {
            console.warn('Could not list storage files:', listError);
            return;
        }

        if (!files || files.length === 0) return;

        // Build full paths for all files
        const filePaths = files.map(f => `${slug}/${f.name}`);

        // Delete all files
        const { error: deleteError } = await db.storage
            .from('products')
            .remove(filePaths);

        if (deleteError) {
            console.warn('Could not delete storage files:', deleteError);
        } else {
            console.log(`✅ Deleted ${filePaths.length} files from storage folder: ${slug}`);
        }
    } catch (e) {
        console.warn('deleteProductStorageFolder error:', e);
    }
}
