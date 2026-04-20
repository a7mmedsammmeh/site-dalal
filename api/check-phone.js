const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const ALLOWED_ORIGINS = ['https://dalalwear.shop', 'https://www.dalalwear.shop', 'https://dalal-lin.vercel.app'];

/* ── Normalize Egyptian phone number ── */
function normalizePhone(phone) {
    if (!phone) return '';
    let cleaned = phone.replace(/[^0-9]/g, '');
    if (cleaned.startsWith('0020') && cleaned.length >= 14) cleaned = cleaned.slice(4);
    else if (cleaned.startsWith('20') && cleaned.length >= 12) cleaned = cleaned.slice(2);
    if (cleaned.startsWith('0') && cleaned.length >= 11) cleaned = cleaned.slice(1);
    return cleaned;
}

export default async function handler(req, res) {
    const origin = req.headers.origin || '';
    if (ALLOWED_ORIGINS.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const phone = req.query.phone || null;
    if (!phone) return res.status(200).json({ blocked: false });

    try {
        // Fetch all blocked phones and compare normalized values
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/blocked_phones?select=phone,reason`,
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
            const normalizedInput = normalizePhone(phone);
            const match = data.find(bp => normalizePhone(bp.phone) === normalizedInput);
            if (match) {
                return res.status(200).json({ blocked: true, reason: match.reason || null });
            }
        }
        return res.status(200).json({ blocked: false });
    } catch (e) {
        return res.status(200).json({ blocked: false });
    }
}
