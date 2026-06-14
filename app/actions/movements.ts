"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, CategoryType, MovementType, Prisma } from "@prisma/client";
import { assertAuthenticated, assertCanWrite } from "@/lib/auth-guards";
import { labelToMovementType, toMovementRecord } from "@/lib/finance/map-movement";
import { exportRecordToSheets } from "@/lib/finance/sheets-export";
import { toClientError } from "@/lib/safe-error";
import { parseInput } from "@/lib/validations/parse";
import {
  applyCategorySuggestionSchema,
  createMovementSchema,
  updateMovementSchema,
  voidMovementSchema,
} from "@/lib/validations/schemas";
import { FUND_CODE_TO_TAB, ORG_SLUG, TAB_TO_FUND_CODE, type CategoryOption, type FundOption, type FundTab, type MovementRecord } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import {
  getDefaultCategoryCodeForEventMovement,
} from "@/lib/finance/event-category";

interface CreateMovementInput {
  date: string;
  amount: number;
  type: "Ingreso" | "Egreso";
  description: string;
  fund: FundTab;
  categoryId?: string;
  eventId?: string;
  projectId?: string;
}

interface UpdateMovementInput extends CreateMovementInput {
  id: string;
}

function movementAuditSnapshot(movement: {
  date: Date;
  amount: Prisma.Decimal;
  movementType: MovementType;
  description: string | null;
  fund: { code: string };
  category: { code: string } | null;
}) {
  return {
    date: movement.date.toISOString(),
    amount: movement.amount.toString(),
    movementType: movement.movementType,
    description: movement.description,
    fundCode: movement.fund.code,
    categoryCode: movement.category?.code ?? null,
  };
}

async function resolveCategoryId(
  organizationId: string,
  movementType: MovementType,
  categoryId?: string | null
) {
  if (categoryId) {
    const category = await prisma.category.findFirst({
      where: { id: categoryId, organizationId, active: true },
    });

    if (!category) {
      throw new Error("Categoría no válida.");
    }

    const expectedType =
      movementType === MovementType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;
    if (category.type !== expectedType) {
      throw new Error("La categoría no coincide con el tipo de movimiento.");
    }

    return category.id;
  }

  const fallbackCode = movementType === MovementType.EXPENSE ? "OTROS_GASTO" : "OTROS";
  const fallback = await prisma.category.findUnique({
    where: {
      organizationId_code: { organizationId, code: fallbackCode },
    },
  });

  return fallback?.id ?? null;
}

async function resolveCategoryIdForMovement(
  organizationId: string,
  movementType: MovementType,
  categoryId: string | null | undefined,
  eventId: string | null
) {
  if (eventId) {
    const code = getDefaultCategoryCodeForEventMovement(movementType);
    const eventCategory = await prisma.category.findUnique({
      where: {
        organizationId_code: { organizationId, code },
      },
    });

    const expectedType =
      movementType === MovementType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;

    if (eventCategory?.type === expectedType) {
      return eventCategory.id;
    }
  }

  return resolveCategoryId(organizationId, movementType, categoryId);
}

async function resolveEventId(organizationId: string, eventId?: string | null) {
  if (!eventId) return null;

  const event = await prisma.fundraisingEvent.findFirst({
    where: { id: eventId, organizationId },
  });

  if (!event) {
    throw new Error("Actividad no válida.");
  }

  return event.id;
}

async function resolveProjectId(
  organizationId: string,
  fundCode: string,
  projectId?: string | null
) {
  if (!projectId) return null;

  if (fundCode !== "FONDO_AHORRO") {
    throw new Error("Solo los movimientos del Fondo de Ahorro pueden vincularse a un proyecto.");
  }

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId },
  });

  if (!project) {
    throw new Error("Proyecto no válido.");
  }

  return project.id;
}

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

export async function fetchMovementsData(): Promise<MovementRecord[]> {
  await assertAuthenticated();
  const organizationId = await getOrganizationId();

  const movements = await prisma.movement.findMany({
    where: {
      organizationId,
      deletedAt: null,
    },
    include: {
      fund: true,
      category: true,
      event: true,
      project: true,
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  return movements.map(toMovementRecord);
}

export async function getFundOptions(): Promise<FundOption[]> {
  await assertAuthenticated();
  const organizationId = await getOrganizationId();

  const funds = await prisma.fund.findMany({
    where: { organizationId, active: true },
    orderBy: { sortOrder: "asc" },
  });

  return funds.map((fund) => ({
    id: fund.id,
    code: fund.code,
    name: fund.name,
    tab: (FUND_CODE_TO_TAB[fund.code] ?? "caja_chica") as FundTab,
  }));
}

export async function getAllCategoryOptions(): Promise<CategoryOption[]> {
  await assertAuthenticated();
  const organizationId = await getOrganizationId();

  const categories = await prisma.category.findMany({
    where: { organizationId, active: true },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
  });

  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    type: category.type,
  }));
}

export async function getCategoryOptions(type: "Ingreso" | "Egreso"): Promise<CategoryOption[]> {
  await assertAuthenticated();
  const organizationId = await getOrganizationId();
  const categoryType = type === "Ingreso" ? CategoryType.INCOME : CategoryType.EXPENSE;

  const categories = await prisma.category.findMany({
    where: {
      organizationId,
      active: true,
      type: categoryType,
    },
    orderBy: { sortOrder: "asc" },
  });

  return categories.map((category) => ({
    id: category.id,
    code: category.code,
    name: category.name,
    type: category.type,
  }));
}

export async function createMovement(input: CreateMovementInput) {
  try {
    const userId = await assertCanWrite();
    const data = parseInput(createMovementSchema, input);
    const organizationId = await getOrganizationId();
    const movementType = labelToMovementType(data.type);
    const fundCode = TAB_TO_FUND_CODE[data.fund];

    const fund = await prisma.fund.findUnique({
      where: {
        organizationId_code: {
          organizationId,
          code: fundCode,
        },
      },
    });

    if (!fund) {
      throw new Error(`Fondo ${fundCode} no encontrado.`);
    }

    const resolvedEventId = await resolveEventId(organizationId, data.eventId);
    const resolvedProjectId = await resolveProjectId(
      organizationId,
      fundCode,
      data.projectId
    );
    const categoryId = await resolveCategoryIdForMovement(
      organizationId,
      movementType,
      data.categoryId,
      resolvedEventId
    );

    const movement = await prisma.movement.create({
      data: {
        organizationId,
        fundId: fund.id,
        categoryId,
        eventId: resolvedEventId,
        projectId: resolvedProjectId,
        date: new Date(data.date),
        amount: new Prisma.Decimal(Math.abs(data.amount).toFixed(2)),
        movementType,
        description: data.description,
        createdById: userId,
      },
      include: {
        fund: true,
        category: true,
        event: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.CREATE,
        entity: "movements",
        entityId: movement.id,
        newValues: movementAuditSnapshot(movement),
      },
    });

    if (process.env.WRITE_TO_SHEETS !== "false") {
      try {
        await exportRecordToSheets({
          date: data.date,
          amount: Math.abs(data.amount),
          type: data.type,
          description: data.description,
          category: data.fund,
        });
      } catch (exportError) {
        console.error("Exportación a Sheets falló (movimiento guardado en BD):", exportError);
      }
    }

    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reports");
    revalidatePath("/events");
    revalidatePath("/projects");

    return { success: true as const, record: toMovementRecord(movement) };
  } catch (error) {
    console.error("Error creating movement:", error);
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}

export async function updateMovement(input: UpdateMovementInput) {
  try {
    const userId = await assertCanWrite();
    const data = parseInput(updateMovementSchema, input);
    const organizationId = await getOrganizationId();
    const movementType = labelToMovementType(data.type);
    const fundCode = TAB_TO_FUND_CODE[data.fund];

    const existing = await prisma.movement.findFirst({
      where: { id: data.id, organizationId, deletedAt: null },
      include: { fund: true, category: true, event: true, project: true },
    });

    if (!existing) {
      throw new Error("Movimiento no encontrado.");
    }

    if (existing.transferId) {
      throw new Error("Los movimientos de transferencia no se pueden editar aquí.");
    }

    const fund = await prisma.fund.findUnique({
      where: { organizationId_code: { organizationId, code: fundCode } },
    });

    if (!fund) {
      throw new Error(`Fondo ${fundCode} no encontrado.`);
    }

    const resolvedEventId = await resolveEventId(organizationId, data.eventId);
    const resolvedProjectId = await resolveProjectId(
      organizationId,
      fundCode,
      data.projectId
    );
    const categoryId = await resolveCategoryIdForMovement(
      organizationId,
      movementType,
      data.categoryId,
      resolvedEventId
    );
    const oldSnapshot = movementAuditSnapshot(existing);

    const movement = await prisma.movement.update({
      where: { id: data.id },
      data: {
        fundId: fund.id,
        categoryId,
        eventId: resolvedEventId,
        projectId: resolvedProjectId,
        date: new Date(data.date),
        amount: new Prisma.Decimal(Math.abs(data.amount).toFixed(2)),
        movementType,
        description: data.description,
        updatedById: userId,
      },
      include: { fund: true, category: true, event: true, project: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.UPDATE,
        entity: "movements",
        entityId: movement.id,
        oldValues: oldSnapshot,
        newValues: movementAuditSnapshot(movement),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reports");
    revalidatePath("/events");
    revalidatePath("/projects");

    return { success: true as const, record: toMovementRecord(movement) };
  } catch (error) {
    console.error("Error updating movement:", error);
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}

export async function applyCategorySuggestion(movementId: string, categoryId: string) {
  try {
    const userId = await assertCanWrite();
    const { movementId: id, categoryId: catId } = parseInput(
      applyCategorySuggestionSchema,
      { movementId, categoryId }
    );
    const organizationId = await getOrganizationId();

    const existing = await prisma.movement.findFirst({
      where: { id, organizationId, deletedAt: null },
      include: { fund: true, category: true, event: true, project: true },
    });

    if (!existing) {
      throw new Error("Movimiento no encontrado.");
    }

    if (existing.transferId) {
      throw new Error("Las transferencias no llevan categoría contable.");
    }

    const category = await prisma.category.findFirst({
      where: { id: catId, organizationId, active: true },
    });

    if (!category) {
      throw new Error("Categoría no encontrada.");
    }

    const expectedType =
      existing.movementType === MovementType.INCOME ? CategoryType.INCOME : CategoryType.EXPENSE;

    if (category.type !== expectedType) {
      throw new Error("La categoría no corresponde al tipo de movimiento.");
    }

    const oldSnapshot = movementAuditSnapshot(existing);

    const movement = await prisma.movement.update({
      where: { id },
      data: { categoryId: catId, updatedById: userId },
      include: { fund: true, category: true, event: true, project: true },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.UPDATE,
        entity: "movements",
        entityId: movement.id,
        oldValues: oldSnapshot,
        newValues: movementAuditSnapshot(movement),
        metadata: { source: "category_suggestion" },
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reports");

    return { success: true as const, record: toMovementRecord(movement) };
  } catch (error) {
    console.error("Error applying category suggestion:", error);
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}

export async function voidMovement(id: string) {
  try {
    const userId = await assertCanWrite();
    const { id: movementId } = parseInput(voidMovementSchema, { id });
    const organizationId = await getOrganizationId();

    const existing = await prisma.movement.findFirst({
      where: { id: movementId, organizationId, deletedAt: null },
      include: { fund: true, category: true, event: true, project: true },
    });

    if (!existing) {
      throw new Error("Movimiento no encontrado.");
    }

    if (existing.transferId) {
      throw new Error("Anula la transferencia completa desde la página de Transferencias.");
    }

    await prisma.movement.update({
      where: { id: movementId },
      data: { deletedAt: new Date(), updatedById: userId },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.DELETE,
        entity: "movements",
        entityId: movementId,
        oldValues: movementAuditSnapshot(existing),
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reports");
    revalidatePath("/events");
    revalidatePath("/projects");
    revalidatePath("/reconciliation");

    return { success: true as const };
  } catch (error) {
    console.error("Error voiding movement:", error);
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}

export async function logReportExport(metadata: Record<string, unknown>) {
  try {
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.EXPORT,
        entity: "reports",
        entityId: organizationId,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}
