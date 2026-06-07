"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { AuditAction, ReconciliationStatus } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { ORG_SLUG } from "@/lib/finance/types";
import {
  importMissingMovementsFromSheets,
  reconcileOrganizationFunds,
} from "@/lib/finance/sheets-sync";
import { prisma } from "@/lib/prisma";

async function getOrganizationId() {
  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG },
    select: { id: true },
  });

  if (!organization) {
    throw new Error("Organización no configurada. Ejecuta npm run db:seed");
  }

  return organization.id;
}

async function assertCanManage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user?.id) {
    throw new Error("Debes iniciar sesión.");
  }

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para esta acción.");
  }

  return session.user.id;
}

export async function getReconciliationHistory() {
  const organizationId = await getOrganizationId();

  const logs = await prisma.reconciliationLog.findMany({
    where: { organizationId },
    include: { fund: true },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return logs.map((log) => ({
    id: log.id,
    fundName: log.fund.name,
    sheetBalance: Number(log.sheetBalance),
    dbBalance: Number(log.dbBalance),
    delta: Number(log.delta),
    status: log.status,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
  }));
}

export async function runReconciliationCheck() {
  try {
    await assertCanManage();
    const organizationId = await getOrganizationId();
    const results = await reconcileOrganizationFunds(prisma, organizationId);

    for (const result of results) {
      await prisma.reconciliationLog.create({
        data: {
          organizationId,
          fundId: result.fundId,
          sheetBalance: result.sheetBalance,
          dbBalance: result.dbBalance,
          delta: result.delta,
          status:
            result.status === "MATCH"
              ? ReconciliationStatus.MATCH
              : ReconciliationStatus.MISMATCH,
          notes: `Conciliación manual (${result.rowCount} filas en Sheets)`,
        },
      });
    }

    revalidatePath("/reconciliation");

    return { success: true as const, results };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export async function runSheetsImport() {
  try {
    const userId = await assertCanManage();
    const organizationId = await getOrganizationId();
    const { imported, skipped } = await importMissingMovementsFromSheets(
      prisma,
      organizationId
    );

    const results = await reconcileOrganizationFunds(prisma, organizationId);

    for (const result of results) {
      await prisma.reconciliationLog.create({
        data: {
          organizationId,
          fundId: result.fundId,
          sheetBalance: result.sheetBalance,
          dbBalance: result.dbBalance,
          delta: result.delta,
          status:
            result.status === "MATCH"
              ? ReconciliationStatus.MATCH
              : ReconciliationStatus.MISMATCH,
          notes: `Importación desde UI: +${imported} nuevos, ${skipped} omitidos`,
        },
      });
    }

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.IMPORT,
        entity: "movements",
        entityId: organizationId,
        metadata: {
          imported,
          skipped,
          results: results.map((r) => ({
            fundName: r.fundName,
            sheetBalance: r.sheetBalance,
            dbBalance: r.dbBalance,
            delta: r.delta,
            status: r.status,
          })),
        },
      },
    });

    revalidatePath("/reconciliation");
    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reports");

    return { success: true as const, imported, skipped, results };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export async function getCurrentReconciliationSnapshot() {
  const organizationId = await getOrganizationId();
  return reconcileOrganizationFunds(prisma, organizationId);
}
