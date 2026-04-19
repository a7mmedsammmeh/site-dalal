const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const phone = req.query.phone || null;
    if (!phone) return res.status(200).json({ blocked: false });

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/blocked_phones?phone=eq.${encodeURIComponent(phone)}&select=phone,reason&limit=1`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`
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
        return res.status(200).json({ blocked: false });
    }
}
