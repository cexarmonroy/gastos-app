"use server";

import { getServerSession } from "next-auth";
import { AuditAction } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

export interface AuditLogFilters {
  action?: AuditAction;
  entity?: string;
  search?: string;
  limit?: number;
}

async function getOrganizationId() {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada.");
  }

  return organization.id;
}

export async function getAuditLogs(filters: AuditLogFilters = {}) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para ver la auditoría.");
  }

  const organizationId = await getOrganizationId();
  const search = filters.search?.trim();

  const logs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.entity ? { entity: filters.entity } : {}),
      ...(search
        ? {
            OR: [
              { entity: { contains: search, mode: "insensitive" } },
              { entityId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: filters.limit ?? 150,
  });

  return logs.map((log) => ({
    id: log.id,
    action: log.action,
    entity: log.entity,
    entityId: log.entityId,
    userEmail: log.user?.email ?? "Sistema",
    oldValues: log.oldValues,
    newValues: log.newValues,
    metadata: log.metadata,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function getAuditFilterOptions() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para ver la auditoría.");
  }

  const organizationId = await getOrganizationId();
  const entities = await prisma.auditLog.findMany({
    where: { organizationId },
    distinct: ["entity"],
    select: { entity: true },
    orderBy: { entity: "asc" },
  });

  return {
    actions: Object.values(AuditAction),
    entities: entities.map((item) => item.entity),
  };
}
