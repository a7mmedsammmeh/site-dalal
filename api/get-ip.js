/* ═══════════════════════════════════════════════════════════════
   DALAL — /api/get-ip — REMOVED
   ─────────────────────────────────────────────────────────────
   This endpoint has been removed for security (IP enumeration risk).
   Use /api/check-blocked instead.
   Returns 410 Gone to prevent any probing/enumeration.
   ═══════════════════════════════════════════════════════════════ */

export default function handler(req, res) {
    res.status(410).json({ error: 'Gone' });
}
