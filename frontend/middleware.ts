import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Get token from cookies or headers
  const token = request.cookies.get('accessToken')?.value;

  // Protected routes
  const protectedRoutes = ['/dashboard'];
  const authRoutes = ['/login', '/signup'];

  const isProtectedRoute = protectedRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );
  const isAuthRoute = authRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  );

  // If accessing protected route without token, allow it (client-side will handle redirect)
  // This is because we're using client-side auth with Zustand
  // The actual protection happens in the page components

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
