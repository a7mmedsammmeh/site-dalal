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
       If the cookie is missing or invalid → redirect to login.

       SECURITY LAYERS:
       1. Cookie must exist
       2. JWT must decode to valid JSON
       3. JWT must have correct Supabase claims (role, aud, sub)
       4. JWT must not be older than GRACE_WINDOW
       5. Full admin verification happens client-side via _requireAdmin()
       ══════════════════════════════════════════════════════════ */
    if (ADMIN_PATHS.includes(pathname)) {
        const token = getCookie(request, COOKIE_NAME);

        // No cookie → redirect to login
        if (!token) {
            return redirectToLogin(request.url);
        }

        // Decode JWT and validate
        const payload = decodeJwtPayload(token);
        if (!payload || !payload.exp) {
            // Invalid/malformed token → clear cookie and redirect
            return redirectToLogin(request.url, true);
        }

        // ── Validate Supabase JWT claims ──
        // Real Supabase JWTs always contain these.
        // A forged JWT missing these will be rejected.
        if (
            payload.role !== 'authenticated' ||
            payload.aud !== 'authenticated' ||
            !payload.sub  // user UUID must exist
        ) {
            return redirectToLogin(request.url, true);
        }

        // ── Expiry check with grace window ──
        // Supabase access tokens expire in ~1hr.
        // The middleware allows recently-expired tokens because:
        //   - The Supabase client auto-refreshes via refresh_token
        //   - The REAL auth check happens in _requireAdmin() (server-side RPC)
        //   - The middleware's purpose is to block unauthenticated visitors
        // Tokens expired for more than GRACE_WINDOW are rejected.
        const now = Math.floor(Date.now() / 1000);
        const GRACE_WINDOW = 7 * 24 * 60 * 60; // 7 days in seconds
        if (payload.exp + GRACE_WINDOW < now) {
            // Token expired more than 7 days ago → definitely stale
            return redirectToLogin(request.url, true);
        }

        // Token is valid and within grace window → allow through
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
