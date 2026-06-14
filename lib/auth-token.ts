import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export function isSecureAuthCookie(): boolean {
  return process.env.NODE_ENV === "production";
}

export async function getAuthToken(req: NextRequest) {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;

  return getToken({
    req,
    secret,
    secureCookie: isSecureAuthCookie(),
  });
}
