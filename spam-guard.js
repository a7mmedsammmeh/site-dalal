/* ═══════════════════════════════════════════════════════════════
   DALAL — Spam Guard (Hardened)
   • Honeypot field check
   • Timing check (form filled too fast = bot)
   • Rate limiting (max 3 orders per 10 min per browser)
   • Block status check (via /api/check-blocked — no raw IP exposed)
   ═══════════════════════════════════════════════════════════════ */

const SpamGuard = (() => {
    'use strict';

    const RATE_KEY      = 'dalal-order-times';
    const MAX_ORDERS    = 3;
    const WINDOW_MS     = 10 * 60 * 1000;
    const MIN_FILL_MS   = 3000;

    /* ── Block status cache (no raw IP stored) ── */
    let _statusCache = null;
    let _statusPromise = null;

    async function checkBlockStatus() {
        if (_statusCache) return _statusCache;
        if (_statusPromise) return _statusPromise;
        _statusPromise = fetch('/api/check-blocked', { 
            signal: AbortSignal.timeout(8000),
            headers: { 'Accept': 'application/json' }
        })
            .then(r => r.ok ? r.json() : null)
            .then(g => {
                // NOTE: /api/check-blocked never returns raw IP
                // It returns: { blocked, country, city }
                _statusCache = g ? { 
                    blocked: g.blocked || false,
                    country: g.country || null, 
                    city: g.city || null 
                } : { blocked: false, country: null, city: null };
                return _statusCache;
            })
            .catch(() => { 
                _statusCache = { blocked: false, country: null, city: null }; 
                return _statusCache; 
            });
        return _statusPromise;
    }

    /* Prefetch on load so it's ready by the time user submits */
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => checkBlockStatus(), { once: true });
    }

    /* ── Rate limit ── */
    function getRateTimes() {
        try { return JSON.parse(localStorage.getItem(RATE_KEY)) || []; }
        catch { return []; }
    }

    function recordOrder() {
        const now   = Date.now();
        const times = getRateTimes().filter(t => now - t < WINDOW_MS);
        times.push(now);
        localStorage.setItem(RATE_KEY, JSON.stringify(times));
    }

    function isRateLimited() {
        const now   = Date.now();
        const times = getRateTimes().filter(t => now - t < WINDOW_MS);
        return times.length >= MAX_ORDERS;
    }

    /* ── Timing ── */
    function markFormOpen() {
        return Date.now();
    }

    function isTooFast(openedAt) {
        return (Date.now() - openedAt) < MIN_FILL_MS;
    }

    /* ── Honeypot ── */
    // Returns hidden field HTML — must be invisible to humans, bots fill it
    function honeypotHTML() {
        return `<div style="position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden;" aria-hidden="true" tabindex="-1">
            <label for="dalal_website">Website</label>
            <input type="text" id="dalal_website" name="dalal_website" autocomplete="off" tabindex="-1" value="">
        </div>`;
    }

    function isHoneypotFilled() {
        const el = document.getElementById('dalal_website');
        return el && el.value.trim() !== '';
    }

    /* ── Main check — call before submitting ── */
    // Returns { blocked: true, reason: '...' } or { blocked: false }
    function check(openedAt) {
        if (isHoneypotFilled()) {
            return { blocked: true, reason: 'honeypot' };
        }
        if (isTooFast(openedAt)) {
            return { blocked: true, reason: 'too_fast' };
        }
        if (isRateLimited()) {
            return { blocked: true, reason: 'rate_limit' };
        }
        return { blocked: false };
    }

    /* ── Error message ── */
    function errorMsg(reason, lang) {
        const isAr = lang === 'ar';
        if (reason === 'rate_limit') {
            return isAr
                ? 'لقد أرسلت عدة طلبات في وقت قصير. يرجى الانتظار قليلاً أو <a href="contact.html" style="color:var(--gold);text-decoration:underline;">تواصل معنا</a>'
                : 'Too many orders in a short time. Please wait or <a href="contact.html" style="color:var(--gold);text-decoration:underline;">contact us</a>';
        }
        return isAr
            ? 'حدث خطأ في التحقق. يرجى المحاولة مرة أخرى أو <a href="contact.html" style="color:var(--gold);text-decoration:underline;">تواصل معنا</a>'
            : 'Verification failed. Please try again or <a href="contact.html" style="color:var(--gold);text-decoration:underline;">contact us</a>';
    }

    return { check, recordOrder, markFormOpen, honeypotHTML, errorMsg, checkBlockStatus };
})();
