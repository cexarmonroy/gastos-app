import { NextRequest, NextResponse } from "next/server";
import { logSecurityEvent } from "@/lib/security-audit";

type SecurityEventType = "LOGIN_FAILED" | "LOGIN_BLOCKED" | "RATE_LIMIT";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-audit-secret");
  if (!process.env.NEXTAUTH_SECRET || secret !== process.env.NEXTAUTH_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      event: SecurityEventType;
      metadata?: Record<string, unknown>;
    };

    if (!body.event) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    await logSecurityEvent(body.event, body.metadata ?? {});
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Failed to log" }, { status: 500 });
  }
}
