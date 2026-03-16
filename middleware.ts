import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/",
    /*
     * Match all request paths except for:
     * - login (página de acceso)
     * - api (Rutas de API, incluyendo NextAuth)
     * - _next/static (archivos estáticos)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono)
     */
    "/((?!login|api|_next/static|_next/image|favicon.ico).*)",
  ],
};
