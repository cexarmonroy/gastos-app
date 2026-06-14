import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { isPublicPortalEnabled } from "@/lib/public-portal";
import { rateLimit } from "@/lib/rate-limit";

const RESTRICTED_ROUTES = ["/reports", "/reconciliation", "/transfers", "/audit", "/inscripciones"];
const ADMIN_ONLY_ROUTES = ["/users"];
const AUTH_RATE_MAX = 30;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/auth")) {
    if (rateLimit(`auth:${getClientIp(req)}`, AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS)) {
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  if (pathname === "/") {
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal") && isPublicPortalEnabled()) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  const isAdminOnly = ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  if (isAdminOnly && token.role !== "ADMIN") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  const isRestricted = RESTRICTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isRestricted && token.role !== "ADMIN" && token.role !== "DIRECTIVA") {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
