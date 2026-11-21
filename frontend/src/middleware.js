import { NextResponse } from 'next/server';

/**
 * Next.js Edge Middleware
 * Performs fast edge-level route protection by verifying the presence of HttpOnly session cookies.
 * Detailed authorization and role verification are enforced by ProtectedRoute & backend JWT guards.
 */
export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Protect dashboards and the signed-in learner pages (cart, my learning, course player)
  if (pathname.startsWith('/dashboard') || pathname.startsWith('/my-learning') || pathname.startsWith('/cart')) {
    const hasAccessToken = request.cookies.has('accessToken');
    const hasRefreshToken = request.cookies.has('refreshToken');
    // refreshToken is scoped to /auth and never reaches this route; hasSession (path /)
    // marks a still-refreshable session so an expired access cookie doesn't force a logout.
    const hasSession = request.cookies.has('hasSession');

    // If no session cookie is present, redirect to login
    if (!hasAccessToken && !hasRefreshToken && !hasSession) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname + (request.nextUrl.search || ''));
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/my-learning/:path*', '/cart'],
};

