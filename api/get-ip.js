const SUPABASE_URL = 'https://wnzueymobiwecuikwcgx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InduenVleW1vYml3ZWN1aWt3Y2d4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYyNjk1MjEsImV4cCI6MjA5MTg0NTUyMX0.XYpIYxVLdL_xjQ4oYw0XBC8hHwX6ZCH0E-LpA9evHQI';

const HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};

async function supabaseGet(table, filter) {
    const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?${filter}&limit=1`,
        { headers: HEADERS, signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return [];
    return await res.json();
}

async function supabaseInsert(table, body) {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...HEADERS, 'Prefer': 'return=minimal' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(3000)
    });
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ip = req.headers['x-forwarded-for']?.split(',')[0].trim()
            || req.headers['x-real-ip']
            || req.socket?.remoteAddress
            || null;

    const fingerprint = req.query.fp || null;

    if (!ip) {
        return res.status(200).json({ blocked: false, ip: null, country: null, city: null });
    }

    try {
        // Check IP and fingerprint in parallel
        const [ipCheck, fpCheck] = await Promise.all([
            supabaseGet('blocked_ips', `ip=eq.${encodeURIComponent(ip)}&select=ip,reason`),
            fingerprint
                ? supabaseGet('blocked_fingerprints', `fingerprint=eq.${encodeURIComponent(fingerprint)}&select=fingerprint,reason`)
                : Promise.resolve([])
        ]);

        // If IP is blocked → also auto-block the fingerprint if not already blocked
        if (ipCheck.length > 0) {
            if (fingerprint && fpCheck.length === 0) {
                // Auto-block fingerprint linked to this blocked IP
                supabaseInsert('blocked_fingerprints', {
                    fingerprint,
                    reason: `مرتبط بـ IP محظور: ${ip}`,
                    blocked_at: new Date().toISOString()
                }).catch(() => {});
            }
            return res.status(200).json({
                blocked: true,
                reason: ipCheck[0].reason || null,
                ip, country: null, city: null
            });
        }

        // If fingerprint is blocked (even with new IP)
        if (fpCheck.length > 0) {
            return res.status(200).json({
                blocked: true,
                reason: fpCheck[0].reason || null,
                ip, country: null, city: null
            });
        }

    } catch (e) {
        console.error('Block check error:', e);
    }

    // Fetch geolocation
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
