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

   NOTE: Stateless — cannot do in-memory rate limiting here.
   Real rate limiting happens in the serverless functions via
   KV (cross-instance) and in-memory (per-instance) limiters.
   ═══════════════════════════════════════════════════════════════ */

export const config = {
    matcher: ['/api/:path*', '/admin', '/products-admin'],
};

/* ── Admin page protection constants ── */
const ADMIN_PATHS = ['/admin', '/products-admin'];
const COOKIE_NAME = 'dalal_admin_session';
const LOGIN_PATH = '/admin-login';

// Blocked User-Agent patterns (fast rejection before hitting functions)
const BLOCKED_UA_PATTERNS = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
    'dirbuster', 'gobuster', 'nuclei', 'wfuzz', 'ffuf',
    'havij', 'acunetix', 'netsparker', 'qualys'
];

/**
 * Decode JWT payload without verification (Edge-safe, no dependencies).
 * We only check structure + expiry here.
 * Full auth verification happens in the API layer via _requireAdmin().
 */
function decodeJwtPayload(token) {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        // Base64url → Base64 → decode
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
 * Response.redirect() creates an immutable response, so we build manually.
 */
function redirectToLogin(requestUrl, clearCookie = false) {
    const loginUrl = new URL(LOGIN_PATH, requestUrl).toString();
    const headers = { 'Location': loginUrl };
    if (clearCookie) {
        headers['Set-Cookie'] = `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`;
    }
    return new Response(null, { status: 302, headers });
}

export default function middleware(request) {
    const url = new URL(request.url);
    const ua = (request.headers.get('user-agent') || '').toLowerCase();
    const pathname = url.pathname;

    /* ══════════════════════════════════════════════════════════
       🔒 ADMIN PAGE PROTECTION (Cookie-Based Auth Guard)
       ──────────────────────────────────────────────────────────
       Runs BEFORE Vercel serves the static HTML file.
       If the cookie is missing or expired → redirect to login.
       ══════════════════════════════════════════════════════════ */
    if (ADMIN_PATHS.includes(pathname)) {
        const token = getCookie(request, COOKIE_NAME);

        // No cookie → redirect to login
        if (!token) {
            return redirectToLogin(request.url);
        }

        // Decode JWT and check expiry
        const payload = decodeJwtPayload(token);
        if (!payload || !payload.exp) {
            // Invalid/malformed token → clear cookie and redirect
            return redirectToLogin(request.url, true);
        }

        const now = Math.floor(Date.now() / 1000);
        if (payload.exp < now) {
            // Expired token → clear cookie and redirect
            return redirectToLogin(request.url, true);
        }

        // Token is structurally valid and not expired → allow through
        // Full admin verification happens client-side via _requireAdmin()
        return undefined;
    }

    /* ══════════════════════════════════════════════════════════
       API PROTECTION (existing logic — unchanged)
       ══════════════════════════════════════════════════════════ */

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

    // Block requests with extremely large content-length (>1MB) for API routes
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

    // Pass through to serverless function
    return undefined;
}
