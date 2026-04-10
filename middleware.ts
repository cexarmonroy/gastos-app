import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized: ({ token, req }) => {
      const { pathname } = req.nextUrl;
      
      if (!token) return false;

      // Rutas restringidas
  const restrictedRoutes = ["/reports"];
      const isRestricted = restrictedRoutes.some(route => pathname.startsWith(route));

      if (isRestricted) {
        return token.role === "ADMIN" || token.role === "DIRECTIVA";
      }

      return true;
    },
  },
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};