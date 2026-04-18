const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    if (req.method === 'OPTIONS') return res.status(200).end();

    // Get client IP from Vercel headers
    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
            || req.headers['x-real-ip']
            || req.socket?.remoteAddress
            || null;

    if (!ip) {
        return res.status(200).json({ blocked: false, ip: null, country: null, city: null });
    }

    // 1. Check if IP is blocked (server-side — cannot be bypassed by client)
    try {
        const blockRes = await fetch(
            `${SUPABASE_URL}/rest/v1/blocked_ips?ip=eq.${encodeURIComponent(ip)}&select=ip,reason&limit=1`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
                },
                signal: AbortSignal.timeout(3000)
            }
        );
        if (blockRes.ok) {
            const blockData = await blockRes.json();
            if (blockData && blockData.length > 0) {
                return res.status(200).json({
                    blocked: true,
                    reason: blockData[0].reason || null,
                    ip, country: null, city: null
                });
            }
        }
    } catch (e) {
        console.error('Block check error:', e);
    }

    // 2. Fetch geolocation
    let country = null, city = null;
    try {
        const geoRes = await fetch(
            `http://ip-api.com/json/${ip}?fields=status,country,city,query`,
            { signal: AbortSignal.timeout(5000) }
        );
        if (geoRes.ok) {
            const g = await geoRes.json();
            if (g.status === 'success') {
                country = g.country || null;
                city    = g.city    || null;
            }
        }
    } catch (e) {
        console.error('Geo API error:', e);
    }

    return res.status(200).json({ blocked: false, ip, country, city });
}
