const SUPABASE_URL = process.env.SUPABASE_URL || 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

export default async function handler(req, res) {
    // CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const fetchRes = await fetch(
            `${SUPABASE_URL}/rest/v1/site_settings?key=eq.maintenance_mode&select=value`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(4000)
            }
        );

        if (!fetchRes.ok) {
            return res.status(200).json({ maintenance: false });
        }

        const data = await fetchRes.json();
        if (!data || data.length === 0) {
            return res.status(200).json({ maintenance: false });
        }

        const val = data[0].value || {};
        return res.status(200).json({
            maintenance: val.enabled === true,
            message: val.message || null
        });
    } catch (err) {
        // On error, assume site is NOT in maintenance (fail open)
        return res.status(200).json({ maintenance: false });
    }
}
