import { AuditAction, Prisma } from "@prisma/client";
import { ORG_SLUG } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

type SecurityEventType = "LOGIN_FAILED" | "LOGIN_BLOCKED" | "RATE_LIMIT";

export async function logSecurityEvent(
  event: SecurityEventType,
  metadata: Record<string, unknown>
) {
  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: ORG_SLUG },
      select: { id: true },
    });

    if (!organization) return;

    const action =
      event === "LOGIN_FAILED" ? AuditAction.LOGIN_FAILED : AuditAction.SECURITY_ALERT;

    await prisma.auditLog.create({
      data: {
        organizationId: organization.id,
        action,
        entity: "auth",
        entityId: organization.id,
        metadata: { event, ...metadata } as Prisma.InputJsonValue,
      },
    });
  } catch (error) {
    console.error("Security audit log failed:", error);
  }
}

export async function logDataExport(
  userId: string,
  metadata: Record<string, unknown>
) {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada.");
  }

  await prisma.auditLog.create({
    data: {
      organizationId: organization.id,
      userId,
      action: AuditAction.EXPORT,
      entity: String(metadata.entity ?? "exports"),
      entityId: organization.id,
      metadata: metadata as Prisma.InputJsonValue,
    },
  });
}
