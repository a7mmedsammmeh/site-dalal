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
