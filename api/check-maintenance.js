const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const supabase = createClient(
            process.env.SUPABASE_URL || 'https://wnzueymobiwecuikwcgx.supabase.co',
            process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI'
        );

        const { data, error } = await supabase
            .from('site_settings')
            .select('value')
            .eq('key', 'maintenance_mode')
            .single();

        if (error || !data) {
            return res.status(200).json({ maintenance: false });
        }

        const val = data.value || {};
        return res.status(200).json({
            maintenance: val.enabled === true,
            message: val.message || null
        });
    } catch (err) {
        // On error, assume site is NOT in maintenance (fail open)
        return res.status(200).json({ maintenance: false });
    }
};
