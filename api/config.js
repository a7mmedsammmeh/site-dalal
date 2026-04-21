/* ═══════════════════════════════════════════════════════════════
   DALAL — Public Config Endpoint
   ─────────────────────────────────────────────────────────────
   GET /api/config
   
   Returns the public Supabase config (URL + anon key).
   These are PUBLIC values — safe to expose.
   The service_role key is NEVER returned.
   ═══════════════════════════════════════════════════════════════ */

export default function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).json({
        url: process.env.SUPABASE_URL,
        key: process.env.SUPABASE_ANON_KEY
    });
}
