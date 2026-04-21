/* ═══════════════════════════════════════════════════════════════
   DALAL — Admin Authentication (Cookie-Based)
   ─────────────────────────────────────────────────────────────
   POST   /api/admin-auth  → Login  (set HttpOnly cookie)
   DELETE /api/admin-auth  → Logout (clear cookie)

   🔒 SECURITY:
     - HttpOnly cookie prevents XSS token theft
     - Secure flag ensures HTTPS only
     - SameSite=Strict prevents CSRF
     - Rate limited to 10 attempts per 15 minutes
     - Admin role verified server-side via is_admin() RPC
   ═══════════════════════════════════════════════════════════════ */

import {
    setCorsHeaders, getServerIP,
    checkGlobalRateLimit, createMemoryRateLimiter,
    logSecurityEvent, sanitize,
    SUPABASE_URL, SUPABASE_ANON_KEY
} from './_lib/security.js';

/* ── Rate limiter: 10 login attempts per IP per 15 min ── */
const loginLimiter = createMemoryRateLimiter({ maxEntries: 500, windowMs: 900000, maxHits: 10 });

const COOKIE_NAME = 'dalal_admin_session';
const COOKIE_MAX_AGE = 86400; // 24 hours

function setAuthCookie(res, token) {
    const cookie = [
        `${COOKIE_NAME}=${token}`,
        `Max-Age=${COOKIE_MAX_AGE}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Strict'
    ].join('; ');
    res.setHeader('Set-Cookie', cookie);
}

function clearAuthCookie(res) {
    const cookie = [
        `${COOKIE_NAME}=`,
        'Max-Age=0',
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Strict'
    ].join('; ');
    res.setHeader('Set-Cookie', cookie);
}

export default async function handler(req, res) {
    /* ── CORS + Security Headers ── */
    setCorsHeaders(req, res, 'POST, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const ip = getServerIP(req);
    if (checkGlobalRateLimit(ip)) {
        return res.status(429).json({ error: 'Too many requests' });
    }

    /* ══════════════════════════════════════════════════════
       LOGOUT — DELETE /api/admin-auth
       ══════════════════════════════════════════════════════ */
    if (req.method === 'DELETE') {
        clearAuthCookie(res);
        logSecurityEvent('info', 'admin_auth:logout', { ip });
        return res.status(200).json({ success: true });
    }

    /* ══════════════════════════════════════════════════════
       LOGIN — POST /api/admin-auth
       ══════════════════════════════════════════════════════ */
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    /* ── Per-endpoint rate limiting ── */
    if (loginLimiter.check(ip)) {
        logSecurityEvent('warning', 'admin_auth:rate_limited', { ip });
        return res.status(429).json({ error: 'Too many login attempts. Try again later.' });
    }

    const { email, password } = req.body || {};
    if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
    }

    try {
        /* ── Step 1: Sign in with Supabase Auth ── */
        const signInRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: sanitize(email, 100),
                password
            }),
            signal: AbortSignal.timeout(5000)
        });

        if (!signInRes.ok) {
            logSecurityEvent('warning', 'admin_auth:failed_login', {
                ip, detail: `email:${sanitize(email, 30)}`
            });
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        const authData = await signInRes.json();
        const accessToken = authData.access_token;

        if (!accessToken) {
            return res.status(401).json({ error: 'Authentication failed' });
        }

        /* ── Step 2: Verify admin role via is_admin() RPC ── */
        const adminCheckRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/is_admin`, {
            method: 'POST',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            signal: AbortSignal.timeout(4000)
        });

        if (!adminCheckRes.ok) {
            logSecurityEvent('warning', 'admin_auth:rpc_failed', { ip });
            return res.status(403).json({ error: 'Access denied' });
        }

        const isAdmin = await adminCheckRes.json();
        if (!isAdmin) {
            logSecurityEvent('warning', 'admin_auth:not_admin', {
                ip, detail: `email:${sanitize(email, 30)}`
            });
            return res.status(403).json({ error: 'This account does not have admin access' });
        }

        /* ── Step 3: Set secure HttpOnly cookie ── */
        setAuthCookie(res, accessToken);

        logSecurityEvent('info', 'admin_auth:login_success', { ip });

        return res.status(200).json({
            success: true,
            /* Return tokens so the client can set the Supabase session
               in localStorage for client-side SDK operations */
            access_token: accessToken,
            refresh_token: authData.refresh_token
        });

    } catch (err) {
        logSecurityEvent('critical', 'admin_auth:error', {
            ip, detail: err?.message || 'unknown'
        });
        return res.status(500).json({ error: 'Internal server error' });
    }
}
