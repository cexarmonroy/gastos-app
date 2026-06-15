import { NextResponse } from "next/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { getAuthToken } from "@/lib/auth-token";
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

function queueSecurityAudit(req: NextRequest, event: NextFetchEvent, metadata: Record<string, unknown>) {
  if (!process.env.NEXTAUTH_SECRET) return;

  const auditUrl = new URL("/api/internal/security-audit", req.url);
  event.waitUntil(
    fetch(auditUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-audit-secret": process.env.NEXTAUTH_SECRET,
      },
      body: JSON.stringify({ event: "RATE_LIMIT", metadata }),
    }).catch(() => undefined)
  );
}

export async function middleware(req: NextRequest, event: NextFetchEvent) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/api/internal/security-audit")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/auth")) {
    const ip = getClientIp(req);
    if (rateLimit(`auth:${ip}`, AUTH_RATE_MAX, AUTH_RATE_WINDOW_MS)) {
      queueSecurityAudit(req, event, { ip, path: pathname, source: "api_auth" });
      return NextResponse.json(
        { error: "Demasiados intentos. Espera unos minutos." },
        { status: 429 }
      );
    }
    return NextResponse.next();
  }

  const token = await getAuthToken(req);

  if (pathname === "/") {
    if (token) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/portal") && isPublicPortalEnabled()) {
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/", req.url));
  }

  const isAdminOnly = ADMIN_ONLY_ROUTES.some((route) => pathname.startsWith(route));
  if (isAdminOnly && token.role !== "ADMIN") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const isRestricted = RESTRICTED_ROUTES.some((route) => pathname.startsWith(route));
  if (isRestricted && token.role !== "ADMIN" && token.role !== "DIRECTIVA") {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
