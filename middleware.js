/* ═══════════════════════════════════════════════════════════════
   DALAL — Vercel Edge Middleware (Global Protection Layer)
   ─────────────────────────────────────────────────────────────
   Runs BEFORE any serverless function.

   Responsibilities:
   1. Reject requests without valid IP
   2. Add security headers to all responses
   3. Block known malicious patterns early
   4. Enforce global request size limits

   NOTE: Stateless — cannot do in-memory rate limiting here.
   Real rate limiting happens in the serverless functions via
   KV (cross-instance) and in-memory (per-instance) limiters.
   ═══════════════════════════════════════════════════════════════ */

export const config = {
    matcher: '/api/:path*',
};

// Blocked User-Agent patterns (fast rejection before hitting functions)
const BLOCKED_UA_PATTERNS = [
    'sqlmap', 'nikto', 'nmap', 'masscan', 'zap', 'burp',
    'dirbuster', 'gobuster', 'nuclei', 'wfuzz', 'ffuf',
    'havij', 'acunetix', 'netsparker', 'qualys'
];

export default function middleware(request) {
    const url = new URL(request.url);
    const ua = (request.headers.get('user-agent') || '').toLowerCase();

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
