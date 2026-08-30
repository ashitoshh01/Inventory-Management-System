import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAuthRoute = nextUrl.pathname.startsWith('/login') || nextUrl.pathname.startsWith('/register');
      
      const dashboardRoutes = ['/products', '/warehouses', '/stock', '/purchasing', '/sales', '/pos', '/reports', '/users', '/settings'];
      const isDashboardRoute = dashboardRoutes.some(route => nextUrl.pathname.startsWith(route));
      
      if (isAuthRoute) {
        if (isLoggedIn) {
          return Response.redirect(new URL('/products', nextUrl));
        }
        return true;
      }

      if (isDashboardRoute && !isLoggedIn) {
        return false;
      }

      if (nextUrl.pathname === '/') {
        return Response.redirect(new URL('/products', nextUrl));
      }

      return true;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
