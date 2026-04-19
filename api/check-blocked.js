export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const ip = req.query.ip || null;
    if (!ip) return res.status(200).json({ blocked: false });

    try {
        const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
        const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

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
