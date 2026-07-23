import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCloudflareContext } from '@opennextjs/cloudflare';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets, favicon, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public')
  ) {
    return NextResponse.next();
  }

  // 2. Define public routes
  const isPublicRoute =
    pathname === '/' ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth');

  // 3. Retrieve session_id cookie
  const sessionId = request.cookies.get('session_id')?.value;

  if (!sessionId) {
    // If user is trying to access a protected route without a session, redirect to home page
    if (!isPublicRoute) {
      const loginUrl = new URL('/', request.nextUrl.origin);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // 4. Session exists, validate it using Cloudflare KV
  try {
    const { env } = await getCloudflareContext();
    const sessionVal = await env.KV.get(`session:${sessionId}`);

    if (!sessionVal) {
      // Session is invalid/expired in KV
      if (!isPublicRoute) {
        const response = NextResponse.redirect(new URL('/', request.nextUrl.origin));
        response.cookies.delete('session_id');
        return response;
      }
    } else {
      // Session is valid, redirect logged-in user away from public landing/login pages to dashboard
      if (pathname === '/' || pathname === '/login') {
        const dashboardUrl = new URL('/dashboard', request.nextUrl.origin);
        return NextResponse.redirect(dashboardUrl);
      }
    }
  } catch (error) {
    console.error('Middleware session check failed:', error);
    // If KV fails in local development or edge case, allow the request to proceed (Fail-Open for resilience)
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except API routes that don't need auth check (like webhooks)
     * and static files.
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
