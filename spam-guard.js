/* ═══════════════════════════════════════════════════════════════
   DALAL — Spam Guard
   • Honeypot field check
   • Timing check (form filled too fast = bot)
   • Rate limiting (max 3 orders per 10 min per browser)
   • Client IP fetch (cached)
   ═══════════════════════════════════════════════════════════════ */

const SpamGuard = (() => {
    'use strict';

    const RATE_KEY      = 'dalal-order-times';
    const MAX_ORDERS    = 3;
    const WINDOW_MS     = 10 * 60 * 1000;
    const MIN_FILL_MS   = 3000;

    /* ── IP cache ── */
    let _ipCache = null;
    let _ipPromise = null;

    async function getClientIP() {
        if (_ipCache) return _ipCache;
        if (_ipPromise) return _ipPromise;
        _ipPromise = fetch('https://ipapi.co/json/', { signal: AbortSignal.timeout(4000) })
            .then(r => r.ok ? r.json() : null)
            .then(g => {
                _ipCache = g ? { ip: g.ip || null, country: g.country_name || null, city: g.city || null } : { ip: null, country: null, city: null };
                return _ipCache;
            })
            .catch(() => { _ipCache = { ip: null, country: null, city: null }; return _ipCache; });
        return _ipPromise;
    }

    /* Prefetch on load so it's ready by the time user submits */
    if (typeof window !== 'undefined') {
        window.addEventListener('load', () => getClientIP(), { once: true });
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

    return { check, recordOrder, markFormOpen, honeypotHTML, errorMsg, getClientIP };
})();
