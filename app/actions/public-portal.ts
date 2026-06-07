"use server";

import { MovementType } from "@prisma/client";
import { buildCategoryBreakdown } from "@/lib/finance/category-breakdown";
import { FUND_CODE_TO_TAB, ORG_SLUG } from "@/lib/finance/types";
import { toMovementRecord } from "@/lib/finance/map-movement";
import { isPublicPortalEnabled } from "@/lib/public-portal";
import { prisma } from "@/lib/prisma";

export async function getPublicTreasurySummary() {
  if (!isPublicPortalEnabled()) {
    return null;
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG, active: true },
    select: { id: true, name: true },
  });

  if (!organization) {
    return null;
  }

  const movements = await prisma.movement.findMany({
    where: { organizationId: organization.id, deletedAt: null },
    include: { fund: true, category: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const records = movements.map(toMovementRecord);

  const totalCajaChica = records
    .filter((record) => record.category === "caja_chica")
    .reduce((sum, record) => sum + record.amount, 0);

  const totalFondoAhorro = records
    .filter((record) => record.category === "fondo_ahorro")
    .reduce((sum, record) => sum + record.amount, 0);

  const totalIngresos = records
    .filter((record) => record.type === "Ingreso")
    .reduce((sum, record) => sum + Math.abs(record.amount), 0);

  const totalEgresos = records
    .filter((record) => record.type === "Egreso")
    .reduce((sum, record) => sum + Math.abs(record.amount), 0);

  const expenseBreakdown = buildCategoryBreakdown(
    records.filter((record) => record.type === "Egreso")
  ).slice(0, 5);

  const incomeBreakdown = buildCategoryBreakdown(
    records.filter((record) => record.type === "Ingreso")
  ).slice(0, 5);

  const recentMovements = records.slice(0, 12).map((record) => ({
    date: record.date,
    description: record.description,
    type: record.type,
    amount: Math.abs(record.amount),
    fundName: record.fundName,
    categoryName: record.categoryName,
  }));

  const funds = await prisma.fund.findMany({
    where: { organizationId: organization.id, active: true },
    orderBy: { sortOrder: "asc" },
    select: { name: true, code: true },
  });

  const fundBalances = funds.map((fund) => {
    const tab = FUND_CODE_TO_TAB[fund.code] ?? "caja_chica";
    const balance = records
      .filter((record) => record.category === tab)
      .reduce((sum, record) => sum + record.amount, 0);

    return { name: fund.name, balance };
  });

  const lastMovementDate = movements[0]?.date.toISOString() ?? null;

  return {
    organizationName: organization.name,
    generatedAt: new Date().toISOString(),
    lastMovementDate,
    fundBalances,
    totalSaldo: totalCajaChica + totalFondoAhorro,
    totalIngresos,
    totalEgresos,
    movementCount: records.length,
    expenseBreakdown,
    incomeBreakdown,
    recentMovements,
  };
}

export async function getPublicProjectsSummary() {
  if (!isPublicPortalEnabled()) {
    return [];
  }

  const organization = await prisma.organization.findUnique({
    where: { slug: ORG_SLUG, active: true },
    select: { id: true },
  });

  if (!organization) {
    return [];
  }

  const projects = await prisma.project.findMany({
    where: {
      organizationId: organization.id,
      status: { in: ["PLANNED", "IN_PROGRESS", "COMPLETED"] },
    },
    include: {
      movements: {
        where: { deletedAt: null },
        select: { amount: true, movementType: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return projects.map((project) => {
    const totalIncome = project.movements
      .filter((movement) => movement.movementType === MovementType.INCOME)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const totalExpense = project.movements
      .filter((movement) => movement.movementType === MovementType.EXPENSE)
      .reduce((sum, movement) => sum + Number(movement.amount), 0);

    const target = Number(project.targetAmount);
    const progress = target > 0 ? Math.min(100, Math.round((totalIncome / target) * 100)) : 0;

    return {
      name: project.name,
      status: project.status,
      targetAmount: target,
      totalIncome,
      totalExpense,
      balance: totalIncome - totalExpense,
      progress,
    };
  });
}
