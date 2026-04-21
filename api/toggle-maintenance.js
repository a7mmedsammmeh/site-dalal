const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        // Get Authorization header (admin must be logged in)
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        const token = authHeader.replace('Bearer ', '');

        // Verify admin via RPC using raw fetch
        const rpcRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(5000)
        });

        if (!rpcRes.ok) {
            return res.status(403).json({ error: 'Forbidden — admin only' });
        }
        
        const isAdmin = await rpcRes.json();
        if (!isAdmin) {
            return res.status(403).json({ error: 'Forbidden — admin only' });
        }

        // Parse request body
        const { enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: '"enabled" must be a boolean' });
        }

        // Get current settings to preserve message
        const currentRes = await fetch(
            `${SUPABASE_URL}/rest/v1/site_settings?key=eq.maintenance_mode&select=value`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`, // Pass user token
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(4000)
            }
        );

        let currentValue = {};
        if (currentRes.ok) {
            const data = await currentRes.json();
            if (data && data.length > 0) {
                currentValue = data[0].value || {};
            }
        }

        const newValue = {
            ...currentValue,
            enabled: enabled,
        };

        // Update via UPSERT emulation, but since we prevented INSERTs for site_settings,
        // we should execute a PATCH (UPDATE) request to site_settings table.
        const updateRes = await fetch(
            `${SUPABASE_URL}/rest/v1/site_settings?key=eq.maintenance_mode`,
            {
                method: 'PATCH',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'return=minimal'
                },
                body: JSON.stringify({
                    value: newValue,
                    updated_at: new Date().toISOString()
                }),
                signal: AbortSignal.timeout(5000)
            }
        );

        if (!updateRes.ok) {
            const errText = await updateRes.text();
            console.error('Toggle maintenance error (REST API):', errText);
            return res.status(500).json({ error: 'Failed to update maintenance mode' });
        }

        return res.status(200).json({
            success: true,
            maintenance: enabled
        });
    } catch (err) {
        console.error('Toggle maintenance error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
