/* ═══════════════════════════════════════════════════════════════
   DALAL — Supabase Admin Functions (HARDENED)
   ─────────────────────────────────────────────────────────────
   ⚠️ This file must ONLY be loaded on admin pages:
      - admin.html
      - products-admin.html
   
   It must NEVER be included on public pages.
   All functions here require getSupabase() from supabase.js.

   🔒 SECURITY LAYERS:
     1. File separation — not loaded on public pages
     2. Auth guard — every function verifies active Supabase session
     3. Input validation — type/format checks on all parameters
     4. Confirmation flags — destructive bulk actions require explicit confirm
     5. RLS — server-side enforcement (last line of defense)
   ═══════════════════════════════════════════════════════════════ */

/* ── Auth Guard ──────────────────────────────────────────────
   Verifies an active Supabase auth session exists AND the user
   is in the admins table. Uses is_admin() RPC (SECURITY DEFINER).
   Unlike a simple IS_ADMIN flag, this CANNOT be faked from
   the console — it requires real credentials + DB-level role.
   ──────────────────────────────────────────────────────────── */
let _adminVerified = false; // Cache per page load

async function _requireAdmin() {
    const db = await getSupabase();
    const { data: { session } } = await db.auth.getSession();
    if (!session) {
        throw new Error('⛔ Unauthorized: Admin session required');
    }
    // Verify admin role (cached after first check per page load)
    if (!_adminVerified) {
        const { data: isAdmin, error } = await db.rpc('is_admin');
        if (error || !isAdmin) {
            throw new Error('⛔ Unauthorized: Not an admin');
        }
        _adminVerified = true;
    }
    return db;
}

/* ── Input Validators ────────────────────────────────────── */
const _VALID_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const _UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const _IP_RE   = /^(\d{1,3}\.){3}\d{1,3}$/;
const _PHONE_RE = /^[\d\+\-\s\(\)]{7,20}$/;

function _validId(id) {
    if (!id) throw new Error('Missing ID');
    const s = String(id);
    // Accept both UUID and numeric IDs
    if (!_UUID_RE.test(s) && !/^\d+$/.test(s)) throw new Error('Invalid ID format');
    return s;
}

function _validStr(val, name, maxLen = 500) {
    if (val == null || typeof val !== 'string') throw new Error(`${name} must be a string`);
    if (val.length > maxLen) throw new Error(`${name} exceeds ${maxLen} characters`);
    return val;
}

/* ─── Orders (Admin) ─── */

async function fetchOrders() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('orders')
        .select('id, order_ref, name, phone, email, address, products, total, status, cancel_reason, created_at, lang, order_source, client_ip, client_country, client_city, fingerprint')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function updateOrderStatus(id, status, cancelReason = null) {
    _validId(id);
    if (!_VALID_STATUSES.includes(status)) throw new Error(`Invalid status: ${status}. Allowed: ${_VALID_STATUSES.join(', ')}`);
    if (cancelReason !== null) _validStr(cancelReason, 'cancelReason', 1000);

    const db = await _requireAdmin();
    const updateData = { status };
    if (cancelReason !== null) updateData.cancel_reason = cancelReason;
    
    const { error } = await db
        .from('orders')
        .update(updateData)
        .eq('id', id);
    if (error) throw error;
}

async function deleteOrder(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db
        .from('orders')
        .delete()
        .eq('id', id);
    if (error) throw error;
}

async function deleteAllOrders(confirmAction = false) {
    if (confirmAction !== true) throw new Error('⛔ Confirmation required: pass confirmAction=true');
    const db = await _requireAdmin();
    const { error } = await db
        .from('orders')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}

/* ─── Reviews (Admin) ─── */

async function fetchAllReviews() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('reviews')
        .select('id, name, rating, comment, is_visible, is_pinned, created_at')
        .order('created_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function deleteReview(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('reviews').delete().eq('id', id);
    if (error) throw error;
}

async function toggleReviewVisibility(id, visible) {
    _validId(id);
    if (typeof visible !== 'boolean') throw new Error('visible must be boolean');
    const db = await _requireAdmin();
    const { error } = await db.from('reviews').update({ is_visible: visible }).eq('id', id);
    if (error) throw error;
}

async function toggleReviewPin(id, pinned) {
    _validId(id);
    if (typeof pinned !== 'boolean') throw new Error('pinned must be boolean');
    const db = await _requireAdmin();
    const { error } = await db.from('reviews').update({ is_pinned: pinned }).eq('id', id);
    if (error) throw error;
}

/* ─── Visitors (Admin) ─── */

async function fetchVisitors() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('visitors')
        .select('id, ip, country, city, fingerprint, device_type, os, browser, screen_res, lang, timezone, visited_at, referrer, page')
        .order('visited_at', { ascending: false });
    if (error) throw error;
    return data;
}

async function deleteVisitor(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('visitors').delete().eq('id', id);
    if (error) throw error;
}

async function deleteAllVisitors(confirmAction = false) {
    if (confirmAction !== true) throw new Error('⛔ Confirmation required: pass confirmAction=true');
    const db = await _requireAdmin();
    const { error } = await db
        .from('visitors')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}

/* ─── Blocked IPs (Admin) ─── */

async function fetchBlockedIPs() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('blocked_ips')
        .select('id, ip, reason, blocked_at')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockIP(ip, reason = null) {
    _validStr(ip, 'ip', 45);
    if (!_IP_RE.test(ip)) throw new Error(`Invalid IP format: ${ip}`);
    if (reason !== null) _validStr(reason, 'reason', 500);

    const db = await _requireAdmin();
    const { error } = await db.from('blocked_ips').insert([{
        ip,
        reason,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockIP(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('blocked_ips').delete().eq('id', id);
    if (error) throw error;
}

async function unblockIPFull(ip) {
    _validStr(ip, 'ip', 45);
    if (!_IP_RE.test(ip)) throw new Error(`Invalid IP format: ${ip}`);
    const db = await _requireAdmin();
    await db.from('blocked_ips').delete().eq('ip', ip);
    await db.from('blocked_fingerprints').delete().eq('blocked_ip_ref', ip);
}

/* ─── Blocked Phones (Admin) ─── */

async function fetchBlockedPhones() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('blocked_phones')
        .select('id, phone, reason, blocked_at')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockPhone(phone, reason = null) {
    _validStr(phone, 'phone', 20);
    if (!_PHONE_RE.test(phone)) throw new Error(`Invalid phone format: ${phone}`);
    if (reason !== null) _validStr(reason, 'reason', 500);

    const db = await _requireAdmin();
    const { error } = await db.from('blocked_phones').insert([{
        phone,
        reason,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockPhone(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('blocked_phones').delete().eq('id', id);
    if (error) throw error;
}

/* ─── Blocked Fingerprints (Admin) ─── */

async function fetchBlockedFingerprints() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('blocked_fingerprints')
        .select('id, fingerprint, reason, blocked_ip_ref, blocked_at')
        .order('blocked_at', { ascending: false });
    if (error) throw error;
    return data || [];
}

async function blockFingerprint(fingerprint, reason = null, blocked_ip_ref = null) {
    _validStr(fingerprint, 'fingerprint', 100);
    if (reason !== null) _validStr(reason, 'reason', 500);
    if (blocked_ip_ref !== null) _validStr(blocked_ip_ref, 'blocked_ip_ref', 45);

    const db = await _requireAdmin();
    const { error } = await db.from('blocked_fingerprints').insert([{
        fingerprint,
        reason,
        blocked_ip_ref,
        blocked_at: new Date().toISOString()
    }]);
    if (error) throw error;
}

async function unblockFingerprint(id) {
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('blocked_fingerprints').delete().eq('id', id);
    if (error) throw error;
}

/* ─── Product Stock (Admin — write operations) ─── */

async function fetchProductStock() {
    const db = await _requireAdmin();
    const { data, error } = await db
        .from('product_stock')
        .select('id, product_id, in_stock, visibility_status, updated_at');
    if (error) throw error;
    return data || [];
}

async function updateProductStock(productId, inStock, visibilityStatus = null) {
    if (!productId) throw new Error('Missing productId');
    if (typeof inStock !== 'boolean') throw new Error('inStock must be boolean');
    if (visibilityStatus !== null && !['visible', 'out_of_stock', 'hidden'].includes(visibilityStatus)) {
        throw new Error(`Invalid visibilityStatus: ${visibilityStatus}`);
    }

    const db = await _requireAdmin();
    const { data: existing } = await db
        .from('product_stock')
        .select('id')
        .eq('product_id', productId)
        .limit(1);
    
    const updateData = { 
        in_stock: inStock, 
        updated_at: new Date().toISOString() 
    };
    
    if (visibilityStatus !== null) {
        updateData.visibility_status = visibilityStatus;
    }
    
    if (existing && existing.length > 0) {
        const { error } = await db
            .from('product_stock')
            .update(updateData)
            .eq('product_id', productId);
        if (error) throw error;
    } else {
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

/* ─── Activity Logs (Admin) ─── */

async function logActivity(actionType, actionDescription, entityType = null, entityId = null, details = null) {
    try {
        _validStr(actionType, 'actionType', 50);
        _validStr(actionDescription, 'actionDescription', 1000);

        const db = await _requireAdmin();
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
            entity_type: entityType ? String(entityType) : null,
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
    if (typeof limit !== 'number' || limit < 1 || limit > 1000) throw new Error('limit must be 1-1000');

    const db = await _requireAdmin();
    let query = db
        .from('activity_logs')
        .select('id, action_type, action_description, entity_type, entity_id, details, ip_address, created_at')
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
    _validId(id);
    const db = await _requireAdmin();
    const { error } = await db.from('activity_logs').delete().eq('id', id);
    if (error) throw error;
}

async function clearActivityLogs(confirmAction = false) {
    if (confirmAction !== true) throw new Error('⛔ Confirmation required: pass confirmAction=true');
    const db = await _requireAdmin();
    const { error } = await db
        .from('activity_logs')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) throw error;
}

/* ─── Products Management (Admin) ─── */

async function insertProduct(productData) {
    if (!productData || typeof productData !== 'object') throw new Error('productData must be an object');
    if (!productData.slug) throw new Error('Product slug is required');
    if (!productData.code) throw new Error('Product code is required');
    if (!productData.name_ar) throw new Error('Product name_ar is required');
    if (!productData.name_en) throw new Error('Product name_en is required');

    const db = await _requireAdmin();
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
    _validId(id);
    if (!productData || typeof productData !== 'object') throw new Error('productData must be an object');

    const db = await _requireAdmin();
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
    _validId(id);
    if (typeof displayOrder !== 'number') throw new Error('displayOrder must be a number');

    const db = await _requireAdmin();
    const { error } = await db.from('products').update({
        display_order: displayOrder,
        updated_at: new Date().toISOString()
    }).eq('id', id);
    if (error) throw error;
}

async function deleteProduct(id) {
    _validId(id);
    const db = await _requireAdmin();
    
    try {
        const { data: product, error: fetchError } = await db
            .from('products')
            .select('slug')
            .eq('id', id)
            .single();

        if (fetchError) console.warn('Could not fetch product slug:', fetchError);
        const slug = product?.slug;

        const { error: imagesError } = await db.from('product_images').delete().eq('product_id', id);
        if (imagesError) console.warn('Error deleting product images:', imagesError);
        
        const { error: pricingError } = await db.from('product_pricing').delete().eq('product_id', id);
        if (pricingError) console.warn('Error deleting product pricing:', pricingError);
        
        const { error: stockError } = await db.from('product_stock').delete().eq('product_id', id);
        if (stockError) console.warn('Error deleting product stock:', stockError);
        
        const { error: reviewsError } = await db.from('product_reviews').delete().eq('product_id', id);
        if (reviewsError) console.warn('Error deleting product reviews:', reviewsError);
        
        if (slug) await deleteProductStorageFolder(slug);
        
        const { error: productError } = await db.from('products').delete().eq('id', id);
        if (productError) throw productError;
        
    } catch (error) {
        console.warn('Error in deleteProduct:', error);
        throw error;
    }
}

/* ─── Product Images (Admin) ─── */

async function insertProductImage(productId, imageUrl, order) {
    if (!productId) throw new Error('Missing productId');
    _validStr(imageUrl, 'imageUrl', 2000);
    if (typeof order !== 'number') throw new Error('order must be a number');

    const db = await _requireAdmin();
    const { error } = await db.from('product_images').insert([{
        product_id: productId,
        image_url: imageUrl,
        image_order: order
    }]);
    if (error) throw error;
}

async function deleteProductImages(productId) {
    if (!productId) throw new Error('Missing productId');
    const db = await _requireAdmin();
    const { error } = await db.from('product_images').delete().eq('product_id', productId);
    if (error) throw error;
}

async function deleteProductImage(imageId) {
    _validId(imageId);
    const db = await _requireAdmin();
    const { error } = await db.from('product_images').delete().eq('id', imageId);
    if (error) throw error;
}

/* ─── Product Pricing (Admin) ─── */

async function insertProductPricing(productId, language, offers) {
    if (!productId) throw new Error('Missing productId');
    if (!['ar', 'en'].includes(language)) throw new Error('language must be "ar" or "en"');
    if (!Array.isArray(offers) || !offers.length) throw new Error('offers must be a non-empty array');

    const db = await _requireAdmin();
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
    if (!productId) throw new Error('Missing productId');
    const db = await _requireAdmin();
    const { error } = await db.from('product_pricing').delete().eq('product_id', productId);
    if (error) throw error;
}

/* ─── Product Storage (Admin)
   ⚠️ SECURITY NOTE: Supabase storage bucket 'products' must be configured:
     - Public READ: allowed (for product images)
     - INSERT/UPDATE/DELETE: admin-only (via storage policies)
   Verify in Supabase Dashboard → Storage → Policies
─── */

async function uploadProductImage(file, fileName) {
    if (!file) throw new Error('Missing file');
    _validStr(fileName, 'fileName', 500);

    const db = await _requireAdmin();
    const { data, error } = await db.storage
        .from('products')
        .upload(fileName, file, {
            cacheControl: '3600',
            upsert: false
        });
    if (error) throw error;
    
    const { data: urlData } = db.storage.from('products').getPublicUrl(fileName);
    return urlData.publicUrl;
}

async function deleteProductStorageFolder(slug) {
    if (!slug || typeof slug !== 'string') return;
    const db = await _requireAdmin();

    try {
        const { data: files, error: listError } = await db.storage
            .from('products')
            .list(slug);

        if (listError) {
            console.warn('Could not list storage files:', listError);
            return;
        }

        if (!files || files.length === 0) return;

        const filePaths = files.map(f => `${slug}/${f.name}`);

        const { error: deleteError } = await db.storage
            .from('products')
            .remove(filePaths);

        if (deleteError) {
            console.warn('Could not delete storage files:', deleteError);
        }
    } catch (e) {
        console.warn('deleteProductStorageFolder error:', e);
    }
}
