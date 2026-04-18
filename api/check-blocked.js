export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const ip = req.query.ip || null;
    if (!ip) return res.status(200).json({ blocked: false });

    try {
        const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
        const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/blocked_ips?ip=eq.${encodeURIComponent(ip)}&select=ip,reason&limit=1`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Content-Type': 'application/json'
                },
                signal: AbortSignal.timeout(3000)
            }
        );

        if (!response.ok) return res.status(200).json({ blocked: false });

        const data = await response.json();
        if (data && data.length > 0) {
            return res.status(200).json({ blocked: true, reason: data[0].reason || null });
        }
        return res.status(200).json({ blocked: false });
    } catch (e) {
        console.error('check-blocked error:', e);
        return res.status(200).json({ blocked: false });
    }
}
