"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { AuditAction, MovementType, ProjectStatus, Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { computeProjectKpis } from "@/lib/finance/project-stats";
import { toMovementRecord } from "@/lib/finance/map-movement";
import { ORG_SLUG, type ProjectOption, type ProjectSummary } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";

interface ProjectInput {
  name: string;
  targetAmount: number;
  status?: ProjectStatus;
  description?: string;
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

async function assertCanWrite() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;

  if (!session?.user?.id) {
    throw new Error("Debes iniciar sesión.");
  }

  if (role !== "ADMIN" && role !== "DIRECTIVA") {
    throw new Error("No tienes permisos para gestionar proyectos.");
  }

  return session.user.id;
}

function mapProjectSummary(project: {
  id: string;
  name: string;
  description: string | null;
  targetAmount: Prisma.Decimal;
  status: ProjectStatus;
  movements: Array<{ amount: Prisma.Decimal; movementType: MovementType }>;
}): ProjectSummary {
  const targetAmount = Number(project.targetAmount);
  const kpis = computeProjectKpis(project.movements, targetAmount);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    targetAmount,
    status: project.status,
    totalIncome: kpis.totalIncome,
    totalExpense: kpis.totalExpense,
    balance: kpis.balance,
    movementCount: kpis.movementCount,
    progress: kpis.progress,
  };
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  const organizationId = await getOrganizationId();

  const projects = await prisma.project.findMany({
    where: { organizationId },
    include: {
      movements: {
        where: { deletedAt: null },
        select: { amount: true, movementType: true },
      },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  return projects.map(mapProjectSummary);
}

export async function getProjectDetail(id: string) {
  const organizationId = await getOrganizationId();

  const project = await prisma.project.findFirst({
    where: { id, organizationId },
    include: {
      movements: {
        where: { deletedAt: null },
        include: { fund: true, category: true, event: true, project: true },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      },
    },
  });

  if (!project) {
    throw new Error("Proyecto no encontrado.");
  }

  const summary = mapProjectSummary(project);

  return {
    ...summary,
    movements: project.movements.map(toMovementRecord),
  };
}

export async function getProjectOptions(): Promise<ProjectOption[]> {
  const organizationId = await getOrganizationId();

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      status: { not: ProjectStatus.CANCELLED },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetAmount: true, status: true },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    targetAmount: Number(p.targetAmount),
    status: p.status,
  }));
}

export async function createProject(input: ProjectInput) {
  try {
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    if (input.targetAmount <= 0) {
      throw new Error("La meta debe ser mayor a cero.");
    }

    const project = await prisma.project.create({
      data: {
        organizationId,
        name: input.name.trim(),
        targetAmount: new Prisma.Decimal(input.targetAmount.toFixed(2)),
        status: input.status ?? ProjectStatus.PLANNED,
        description: input.description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.CREATE,
        entity: "projects",
        entityId: project.id,
        newValues: {
          name: project.name,
          targetAmount: project.targetAmount.toString(),
          status: project.status,
        },
      },
    });

    revalidatePath("/projects");

    return { success: true as const, id: project.id };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}

export async function updateProject(id: string, input: ProjectInput) {
  try {
    const userId = await assertCanWrite();
    const organizationId = await getOrganizationId();

    const existing = await prisma.project.findFirst({
      where: { id, organizationId },
    });

    if (!existing) {
      throw new Error("Proyecto no encontrado.");
    }

    if (input.targetAmount <= 0) {
      throw new Error("La meta debe ser mayor a cero.");
    }

    const project = await prisma.project.update({
      where: { id },
      data: {
        name: input.name.trim(),
        targetAmount: new Prisma.Decimal(input.targetAmount.toFixed(2)),
        status: input.status ?? existing.status,
        description: input.description?.trim() || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.UPDATE,
        entity: "projects",
        entityId: project.id,
        oldValues: {
          name: existing.name,
          targetAmount: existing.targetAmount.toString(),
          status: existing.status,
        },
        newValues: {
          name: project.name,
          targetAmount: project.targetAmount.toString(),
          status: project.status,
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${id}`);

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: error instanceof Error ? error.message : "Error desconocido",
    };
  }
}
