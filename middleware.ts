import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';

export default withAuth(
  function middleware(req) {
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;

        // Allow login page and auth API routes
        if (pathname === '/login' || pathname.startsWith('/api/auth')) {
          return true;
        }

        // Require authentication for all other routes
        return !!token;
      },
    },
    pages: {
      signIn: '/login',
    },
  }
);

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
