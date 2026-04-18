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

async function updateOrderStatus(id, status) {
    const db = await getSupabase();
    const { error } = await db
        .from('orders')
        .update({ status })
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
        .select('*')
        .eq('order_ref', ref)
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
