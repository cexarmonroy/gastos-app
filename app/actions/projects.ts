"use server";

import { revalidatePath } from "next/cache";
import {
  AuditAction,
  MovementType,
  ProjectFundingMode,
  ProjectStatus,
  Prisma,
} from "@prisma/client";
import { assertAuthenticated, assertCanWrite } from "@/lib/auth-guards";
import { computeProjectKpis } from "@/lib/finance/project-stats";
import { toMovementRecord } from "@/lib/finance/map-movement";
import { ORG_SLUG, type ProjectOption, type ProjectSummary } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import { toClientError } from "@/lib/safe-error";
import { parseInput } from "@/lib/validations/parse";
import { createProjectSchema, updateProjectSchema } from "@/lib/validations/schemas";

interface ProjectInput {
  name: string;
  targetAmount: number;
  status?: ProjectStatus;
  fundingMode?: ProjectFundingMode;
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

function mapProjectSummary(project: {
  id: string;
  name: string;
  description: string | null;
  targetAmount: Prisma.Decimal;
  status: ProjectStatus;
  fundingMode: ProjectFundingMode;
  movements: Array<{ amount: Prisma.Decimal; movementType: MovementType }>;
}): ProjectSummary {
  const targetAmount = Number(project.targetAmount);
  const kpis = computeProjectKpis(project.movements, targetAmount, project.fundingMode);

  return {
    id: project.id,
    name: project.name,
    description: project.description,
    targetAmount,
    status: project.status,
    fundingMode: project.fundingMode,
    totalIncome: kpis.totalIncome,
    totalExpense: kpis.totalExpense,
    balance: kpis.balance,
    movementCount: kpis.movementCount,
    progress: kpis.progress,
    executionProgress: kpis.executionProgress,
  };
}

export async function fetchProjects(): Promise<ProjectSummary[]> {
  await assertAuthenticated();
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
  await assertAuthenticated();
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
  await assertAuthenticated();
  const organizationId = await getOrganizationId();

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      status: { not: ProjectStatus.CANCELLED },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, targetAmount: true, status: true, fundingMode: true },
  });

  return projects.map((p) => ({
    id: p.id,
    name: p.name,
    targetAmount: Number(p.targetAmount),
    status: p.status,
    fundingMode: p.fundingMode,
  }));
}

export async function createProject(input: ProjectInput) {
  try {
    const userId = await assertCanWrite();
    const data = parseInput(createProjectSchema, input);
    const organizationId = await getOrganizationId();

    const project = await prisma.project.create({
      data: {
        organizationId,
        name: data.name,
        targetAmount: new Prisma.Decimal(data.targetAmount.toFixed(2)),
        status: data.status ?? ProjectStatus.PLANNED,
        fundingMode: data.fundingMode ?? ProjectFundingMode.FUNDRAISING,
        description: data.description || null,
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
          fundingMode: project.fundingMode,
        },
      },
    });

    revalidatePath("/projects");

    return { success: true as const, id: project.id };
  } catch (error) {
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}

export async function updateProject(id: string, input: ProjectInput) {
  try {
    const userId = await assertCanWrite();
    const { id: projectId, input: data } = parseInput(updateProjectSchema, { id, input });
    const organizationId = await getOrganizationId();

    const existing = await prisma.project.findFirst({
      where: { id: projectId, organizationId },
    });

    if (!existing) {
      throw new Error("Proyecto no encontrado.");
    }

    const project = await prisma.project.update({
      where: { id: projectId },
      data: {
        name: data.name,
        targetAmount: new Prisma.Decimal(data.targetAmount.toFixed(2)),
        status: data.status ?? existing.status,
        fundingMode: data.fundingMode ?? existing.fundingMode,
        description: data.description || null,
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
          fundingMode: existing.fundingMode,
        },
        newValues: {
          name: project.name,
          targetAmount: project.targetAmount.toString(),
          status: project.status,
          fundingMode: project.fundingMode,
        },
      },
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);

    return { success: true as const };
  } catch (error) {
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}
