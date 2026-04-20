/* ═══════════════════════════════════════════════════════════════
   DALAL — My Orders (localStorage layer)
   ═══════════════════════════════════════════════════════════════ */

const MY_ORDERS_KEY = 'dalal-my-orders';

/* ─── Generate order ref (cryptographically secure) ─── */
function generateOrderRef() {
    // 30 chars (A-Z minus O/I, 2-9 minus 0/1) = no confusing chars
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const len = 12;
    const arr = new Uint8Array(len);
    crypto.getRandomValues(arr);
    let ref = '';
    for (let i = 0; i < len; i++) ref += chars[arr[i] % chars.length];
    return `DL-${ref}`;
}

/* ─── Save order to localStorage ─── */
function saveOrderLocally(order) {
    const orders = getLocalOrders();
    // avoid duplicates
    const idx = orders.findIndex(o => o.ref === order.ref);
    if (idx >= 0) orders[idx] = order;
    else orders.unshift(order);
    localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(orders));
}

/* ─── Get all local orders ─── */
function getLocalOrders() {
    try { return JSON.parse(localStorage.getItem(MY_ORDERS_KEY)) || []; }
    catch { return []; }
}

/* ─── Sync local orders with Supabase (remove deleted, update status) ─── */
async function syncLocalOrders() {
    const orders = getLocalOrders();
    if (!orders.length) return;

    try {
        const db = await getSupabase();
        const synced = [];

        for (const o of orders) {
            if (!o.ref) {
                synced.push(o);
                continue;
            }

            try {
                // Use RPC function (anon has no direct SELECT on orders)
                const { data, error } = await db.rpc('get_order_by_ref', { p_ref: o.ref });

                if (error) {
                    // RPC error → keep order as-is (don't delete it)
                    synced.push(o);
                    continue;
                }

                if (!data || data.length === 0) {
                    // Order truly doesn't exist → was deleted by admin
                    continue;
                }

                // Update local status from server
                synced.push({ ...o, status: data[0].status, cancel_reason: data[0].cancel_reason });
            } catch {
                // Network error → keep order as-is
                synced.push(o);
            }
        }

        if (JSON.stringify(synced) !== JSON.stringify(orders)) {
            localStorage.setItem(MY_ORDERS_KEY, JSON.stringify(synced));
        }
    } catch { /* silent fail */ }
}
function copyOrderRef(ref) {
    navigator.clipboard?.writeText(ref).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = ref;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
    });
}
