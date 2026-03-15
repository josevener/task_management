import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for Route Guarding
 * 
 * Centralized protection for dashboard routes and redirection for guest-only pages.
 * Based on the session cookie 'task_management.sid'.
 */

/**
 * Middleware for Route Guarding
 * 
 * Centralized protection for dashboard routes and redirection for guest-only pages.
 * Forcefully invalidates sessions that are invalid on the backend.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Get the session cookie
  const sessionToken = request.cookies.get('task_management.sid');
  const isAuthenticated = !!sessionToken;

  // Define route types
  const isAuthPage = pathname.startsWith('/login') ||
    pathname.startsWith('/register') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/reset-password');

  // Dashboard routes (protected) - assuming they are inside (dashboard) group but visible in URL
  // We check for common dashboard prefixes if (dashboard) group is used
  const isDashboardPage = pathname === '/' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/projects') ||
    pathname.startsWith('/tasks') ||
    pathname.startsWith('/my-tasks') ||
    pathname.startsWith('/organizations') ||
    pathname.startsWith('/settings');

  // 1. Redirect authenticated users away from Auth pages
  if (isAuthPage && isAuthenticated) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 2. Redirect unauthenticated users away from Dashboard pages
  if (isDashboardPage && !isAuthenticated) {
    // We redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // 3. Verify session if authenticated and on dashboard
  if (isDashboardPage && isAuthenticated) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8500/api';
      const response = await fetch(`${apiUrl}/auth/me`, {
        headers: {
          'Cookie': `task_management.sid=${sessionToken.value}`
        },
        cache: 'no-store'
      });

      if (!response.ok) {
        // forceful logout
        const redirectResponse = NextResponse.redirect(new URL('/login', request.url));
        redirectResponse.cookies.delete('task_management.sid');
        return redirectResponse;
      }
    }
    catch (error) {
      console.log(`${new Date().toISOString()} >> Session validation error:`, error);
      // In case of backend error (e.g. timeout), we don't necessarily want to log out
      // unless we're sure it's an auth failure. For now, we continue.
    }
  }

  return NextResponse.next();
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public (public files)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
