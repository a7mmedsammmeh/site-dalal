/* ═══════════════════════════════════════════════════════════════
   DALAL — Vercel Edge Middleware (Global Protection Layer)
   ─────────────────────────────────────────────────────────────
   Runs BEFORE any serverless function OR static file.

   Responsibilities:
   1. Reject requests without valid IP
   2. Add security headers to all responses
   3. Block known malicious patterns early
   4. Enforce global request size limits
   5. 🔒 Cookie-based auth guard for admin pages
   6. 🔒 Edge-level IP blocking for all pages
   ═══════════════════════════════════════════════════════════════ */

export const config = {
    matcher: [
        '/',
        '/index.html',
        '/product.html',
        '/products.html',
        '/orders.html',
        '/track.html',
        '/review.html',
        '/contact.html',
        '/about.html',
        '/privacy.html',
        '/404.html',
        '/admin',
        '/products-admin',
        '/admin-login',
        '/api/create-order',
        '/api/submit-review',
        '/api/check-blocked',
        '/api/track-visitor',
        '/api/config',
        '/api/check-maintenance',
        '/api/cancel-order',
        '/api/check-phone',
        '/api/dash-session',
        '/api/security-settings',
        '/api/toggle-maintenance'
    ],
};

/* ── Admin page protection constants ── */
const ADMIN_PATHS = ['/admin', '/products-admin'];
const COOKIE_NAME = 'dalal_admin_session';
const LOGIN_PATH = '/admin-login';

/* ── Pages excluded from IP blocking (prevent redirect loops) ── */
const BLOCK_EXEMPT_PATHS = ['/blocked.html', '/blocked', '/maintenance.html', '/maintenance'];

// Blocked User-Agent patterns (fast rejection before hitting functions)
const BLOCKED_UA_PATTERNS = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
    'dirbuster', 'gobuster', 'nuclei', 'wfuzz', 'ffuf',
    'havij', 'acunetix', 'netsparker', 'qualys'
];

/* ── Supabase config (must be module-level for Edge build) ── */
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

/* ── In-memory IP block cache (shared across requests on same edge instance) ── */
const _ipBlockCache = new Map();
const IP_CACHE_TTL = 30 * 1000; // 30 seconds — fast for testing
const IP_CACHE_MAX = 5000;

/**
 * Check if an IP is blocked via Supabase REST API (with caching).
 */
async function isIPBlocked(ip) {
    if (!ip) return false;

    // Check cache first
    const cached = _ipBlockCache.get(ip);
    if (cached && (Date.now() - cached.at) < IP_CACHE_TTL) {
        return cached.blocked;
    }

    if (!SUPABASE_URL || !SUPABASE_KEY) return false; // can't check, allow through

    try {
        const res = await fetch(
            `${SUPABASE_URL}/rest/v1/blocked_ips?ip=eq.${encodeURIComponent(ip)}&select=ip&limit=1`,
            {
                headers: {
                    'apikey': SUPABASE_KEY,
                    'Authorization': `Bearer ${SUPABASE_KEY}`,
                    'Accept': 'application/json'
                },
                signal: AbortSignal.timeout(3000)
            }
        );

        if (res.ok) {
            const data = await res.json();
            const blocked = data.length > 0;

            // Cache the result
            if (_ipBlockCache.size > IP_CACHE_MAX) {
                // Evict oldest entries
                const oldest = [..._ipBlockCache.entries()]
                    .sort((a, b) => a[1].at - b[1].at)
                    .slice(0, 1000);
                oldest.forEach(([k]) => _ipBlockCache.delete(k));
            }
            _ipBlockCache.set(ip, { blocked, at: Date.now() });

            return blocked;
        }
    } catch {
        // On error, allow through (don't block everyone if DB is down)
    }

    return false;
}

/**
 * Decode JWT payload without verification (Edge-safe, no dependencies).
 */
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const decoded = atob(base64);
        return JSON.parse(decoded);
    } catch {
        return null;
    }
}

/**
 * Extract a named cookie from the request.
 */
function getCookie(request, name) {
    const cookieHeader = request.headers.get('cookie') || '';
    const cookies = cookieHeader.split(';');
    for (const cookie of cookies) {
        const [key, ...valueParts] = cookie.split('=');
        if (key.trim() === name) {
            return valueParts.join('=').trim();
        }
    }
    return null;
}

/**
 * Create a redirect response with optional Set-Cookie header.
 */
function redirectToLogin(requestUrl, clearCookie = false) {
    const loginUrl = new URL(LOGIN_PATH, requestUrl).toString();
    const headers = { 'Location': loginUrl };
    if (clearCookie) {
        headers['Set-Cookie'] = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
    }
    return new Response(null, { status: 302, headers });
}

/**
 * Extract client IP from request headers.
 */
function getClientIP(request) {
    return (
        request.headers.get('x-real-ip') ||
        request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        null
    );
}

export default async function middleware(request) {
    const url = new URL(request.url);
    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    const pathname = url.pathname;

    /* ══════════════════════════════════════════════════════════
       🔒 EDGE-LEVEL IP BLOCKING (runs before everything)
       ──────────────────────────────────────────────────────────
       Checks blocked_ips table via Supabase REST API.
       Cached for 5 minutes per edge instance.
       Blocked users see blocked.html — no page content leaks.
       ══════════════════════════════════════════════════════════ */
    if (!BLOCK_EXEMPT_PATHS.some(p => pathname === p || pathname.startsWith(p))
        && !pathname.startsWith('/api/')
        && !pathname.startsWith('/_next/')) {
        const clientIP = getClientIP(request);
        if (clientIP) {
            const blocked = await isIPBlocked(clientIP);
            if (blocked) {
                return new Response(null, {
                    status: 302,
                    headers: { 'Location': new URL('/blocked.html', request.url).toString() }
                });
            }
        }
    }

    /* ══════════════════════════════════════════════════════════
       🔒 LOGIN PAGE PROTECTION (Auto-redirect if already logged in)
       ══════════════════════════════════════════════════════════ */
    if (pathname === '/admin-login') {
        const token = getCookie(request, COOKIE_NAME);
        if (token) {
            const payload = decodeJwtPayload(token);
            if (payload && payload.exp && payload.sub) {
                const now = Math.floor(Date.now() / 1000);
                const GRACE_WINDOW = 7 * 24 * 60 * 60;
                if (payload.exp + GRACE_WINDOW >= now) {
                    return new Response(null, {
                        status: 302,
                        headers: { 'Location': new URL('/admin', request.url).toString() }
                    });
                }
            }
        }
        return undefined;
    }

    /* ══════════════════════════════════════════════════════════
       🔒 ADMIN PAGE PROTECTION (Cookie-Based Auth Guard)
       ══════════════════════════════════════════════════════════ */
    if (ADMIN_PATHS.includes(pathname)) {
        const token = getCookie(request, COOKIE_NAME);

        if (!token) {
            return redirectToLogin(request.url);
        }

        const payload = decodeJwtPayload(token);
        if (!payload || !payload.exp) {
            return redirectToLogin(request.url, true);
        }

        if (
            payload.role !== 'authenticated' ||
            payload.aud !== 'authenticated' ||
            !payload.sub
        ) {
            return redirectToLogin(request.url, true);
        }

        const now = Math.floor(Date.now() / 1000);
        const GRACE_WINDOW = 7 * 24 * 60 * 60;
        if (payload.exp + GRACE_WINDOW < now) {
            return redirectToLogin(request.url, true);
        }

        return undefined;
    }

    /* ══════════════════════════════════════════════════════════
       API PROTECTION
       ══════════════════════════════════════════════════════════ */
    if (pathname.startsWith('/api/')) {
        // Block known attack tools immediately
        for (const pattern of BLOCKED_UA_PATTERNS) {
            if (ua.includes(pattern)) {
                return new Response(
                    JSON.stringify({ error: 'Forbidden' }),
                    {
                        status: 403,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Content-Type-Options': 'nosniff',
                            'X-Frame-Options': 'DENY'
                        }
                    }
                );
            }
        }

        // Block requests with extremely large content-length (>1MB)
        const contentLength = request.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 1048576) {
            return new Response(
                JSON.stringify({ error: 'Request too large' }),
                {
                    status: 413,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Content-Type-Options': 'nosniff'
                    }
                }
            );
        }

        // Block path traversal attempts
        if (url.pathname.includes('..') || url.pathname.includes('%2e%2e')) {
            return new Response(
                JSON.stringify({ error: 'Forbidden' }),
                {
                    status: 403,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Content-Type-Options': 'nosniff'
                    }
                }
            );
        }
    }

    // Pass through
    return undefined;
}

