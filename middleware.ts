import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * TerraData Edge & Routing Security Middleware
 *
 * Intercepts requests for sensitive, hidden, or configuration files (such as /.env, /.git,
 * /.htaccess, /.aws, etc.) and directory traversal attempts, immediately terminating them
 * with a clean 404 response before any application logic or route matching occurs.
 *
 * Legitimate system paths such as `/.well-known/` are explicitly permitted.
 */

// Extensions and filenames commonly targeted by automated vulnerability scanners
const SENSITIVE_EXTENSIONS = /\.(env|git|svn|htaccess|htpasswd|ini|conf|config|bak|backup|old|save|sql|log|swp|DS_Store|yml|yaml|pem|key|crt)$/i;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Explicitly allow legitimate standard directories (e.g., /.well-known/security.txt, ACME challenges)
  if (pathname === '/.well-known' || pathname.startsWith('/.well-known/')) {
    return NextResponse.next();
  }

  // 2. Detect any path segment starting with a dot (e.g., /.env, /foo/.git/config)
  const segments = pathname.split('/').filter(Boolean);
  const hasHiddenSegment = segments.some((segment) => segment.startsWith('.') && segment.length > 1);

  // 3. Detect directory traversal attempts (e.g., /.. /etc/passwd or encoded dots)
  const hasTraversal = pathname.includes('..') || pathname.includes('%2e%2e') || pathname.includes('%2E%2E');

  // 4. Detect sensitive file extensions or filenames
  const isSensitiveFile = SENSITIVE_EXTENSIONS.test(pathname);

  if (pathname.startsWith('/.') || hasHiddenSegment || hasTraversal || isSensitiveFile) {
    return new NextResponse('Not Found', {
      status: 404,
      statusText: 'Not Found',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        'Pragma': 'no-cache',
        'X-Content-Type-Options': 'nosniff',
        'X-Robots-Tag': 'noindex, nofollow, noarchive',
      },
    });
  }

  return NextResponse.next();
}

/**
 * Configure middleware to run on all paths except Next.js static assets and favicon
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static build files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon)
     * Note: requests like /.env, /.git are matched and intercepted.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
