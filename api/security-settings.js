const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Admin authorization required for BOTH viewing and updating limits
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.replace('Bearer ', '');

        // Verify admin via RPC
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!rpcRes.ok) return res.status(403).json({ error: 'Forbidden — admin only' });
        
        const isAdmin = await rpcRes.json();
        if (!isAdmin) return res.status(403).json({ error: 'Forbidden — admin only' });

        // === GET settings ===
        if (req.method === 'GET') {
            const currentRes = await fetch(
                `${SUPABASE_URL}/rest/v1/site_settings?key=eq.security_limits&select=value`,
                {
                    method: 'GET',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    signal: AbortSignal.timeout(4000)
                }
            );

            if (!currentRes.ok) return res.status(500).json({ error: 'Failed to fetch settings' });
            
            const data = await currentRes.json();
            if (!data || data.length === 0) return res.status(404).json({ error: 'No limits configured in DB' });
            
            return res.status(200).json({ success: true, limits: data[0].value || {} });
        }

        // === POST settings ===
        if (req.method === 'POST') {
            const newLimits = req.body || {};
            
            // Validate incoming format to prevent breaking backend logic
            const expectedNumberKeys = ['order_max_per_ip', 'order_window_time', 'phone_cooldown_time', 'duplicate_window_time', 'review_max_per_ip', 'review_window_time', 'max_items_per_order'];
            for (let key of expectedNumberKeys) {
                if (newLimits[key] !== undefined && typeof newLimits[key] !== 'number') {
                    return res.status(400).json({ error: `Invalid type for ${key}, must be number.` });
                }
            }

            const expectedStringKeys = ['order_window_unit', 'phone_cooldown_unit', 'duplicate_window_unit', 'review_window_unit'];
            const allowedUnits = ['minutes', 'hours', 'days', 'weeks'];
            for (let key of expectedStringKeys) {
                if (newLimits[key] !== undefined) {
                    if (typeof newLimits[key] !== 'string') return res.status(400).json({ error: `Invalid type for ${key}, must be string.` });
                    if (!allowedUnits.includes(newLimits[key])) return res.status(400).json({ error: `Invalid unit for ${key}.` });
                }
            }

            // Update via patching
            const updateRes = await fetch(
                `${SUPABASE_URL}/rest/v1/site_settings?key=eq.security_limits`,
                {
                    method: 'PATCH',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json',
                        'Prefer': 'return=minimal'
                    },
                    body: JSON.stringify({
                        value: newLimits,
                        updated_at: new Date().toISOString()
                    }),
                    signal: AbortSignal.timeout(5000)
                }
            );

            if (!updateRes.ok) {
                return res.status(500).json({ error: 'Failed to update security limits' });
            }

            return res.status(200).json({ success: true, limits: newLimits });
        }

    } catch (err) {
        console.error('Security settings error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
