const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
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

        // Create admin client with user's token
        const supabase = createClient(
            process.env.SUPABASE_URL || 'https://wnzueymobiwecuikwcgx.supabase.co',
            process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI',
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        );

        // Verify admin
        const { data: isAdmin, error: adminErr } = await supabase.rpc('is_admin');
        if (adminErr || !isAdmin) {
            return res.status(403).json({ error: 'Forbidden — admin only' });
        }

        // Parse request body
        const { enabled } = req.body || {};
        if (typeof enabled !== 'boolean') {
            return res.status(400).json({ error: '"enabled" must be a boolean' });
        }

        // Get current settings to preserve message
        const { data: current } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        const currentValue = current?.value || {};
        const newValue = {
            ...currentValue,
            enabled: enabled,
        };

        // Update or insert
        const { error: updateErr } = await supabase
            .from('site_settings')
            .upsert({
                key: 'maintenance_mode',
                value: newValue,
                updated_at: new Date().toISOString()
            }, { onConflict: 'key' });

        if (updateErr) {
            console.error('Toggle maintenance error:', updateErr);
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
};
