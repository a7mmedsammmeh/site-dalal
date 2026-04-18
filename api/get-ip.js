// Vercel Serverless Function to get client IP and geolocation
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get IP from Vercel headers
        const ip = req.headers['x-forwarded-for']?.split(',')[0].trim() 
                || req.headers['x-real-ip'] 
                || req.socket.remoteAddress 
                || null;

        if (!ip) {
            return res.status(200).json({ ip: null, country: null, city: null });
        }

        // Fetch geolocation from ip-api.com (server-side, no CORS issue)
        try {
            const geoResponse = await fetch(`http://ip-api.com/json/${ip}?fields=status,country,city,query`, {
                signal: AbortSignal.timeout(5000)
            });

            if (geoResponse.ok) {
                const geoData = await geoResponse.json();
                if (geoData.status === 'success') {
                    return res.status(200).json({
                        ip: geoData.query || ip,
                        country: geoData.country || null,
                        city: geoData.city || null
                    });
                }
            }
        } catch (geoError) {
            console.error('Geo API error:', geoError);
        }

        // Fallback: return IP only
        return res.status(200).json({
            ip,
            country: null,
            city: null
        });

    } catch (error) {
        console.error('IP fetch error:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch IP',
            ip: null, 
            country: null, 
            city: null 
        });
    }
}
