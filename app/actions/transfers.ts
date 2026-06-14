"use server";

import { revalidatePath } from "next/cache";
import { AuditAction, MovementType, Prisma } from "@prisma/client";
import { assertCanManage, assertCanWrite } from "@/lib/auth-guards";
import { exportRecordToSheets } from "@/lib/finance/sheets-export";
import { ORG_SLUG, TAB_TO_FUND_CODE, type FundTab } from "@/lib/finance/types";
import { prisma } from "@/lib/prisma";
import { toClientError } from "@/lib/safe-error";
import { parseInput } from "@/lib/validations/parse";
import { createTransferSchema } from "@/lib/validations/schemas";

interface CreateTransferInput {
  fromFund: FundTab;
  toFund: FundTab;
  amount: number;
  date: string;
  description: string;
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

export async function fetchTransfers() {
  await assertCanManage();
  const organizationId = await getOrganizationId();

  const transfers = await prisma.transfer.findMany({
    where: { organizationId },
    include: {
      fromFund: true,
      toFund: true,
      createdBy: { select: { email: true } },
    },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 50,
  });

  return transfers.map((transfer) => ({
    id: transfer.id,
    date: transfer.date.toISOString(),
    amount: Number(transfer.amount),
    description: transfer.description ?? "",
    fromFundName: transfer.fromFund.name,
    toFundName: transfer.toFund.name,
    fromFundTab: transfer.fromFund.code === "CAJA_CHICA" ? "caja_chica" : "fondo_ahorro",
    toFundTab: transfer.toFund.code === "CAJA_CHICA" ? "caja_chica" : "fondo_ahorro",
    createdByEmail: transfer.createdBy?.email ?? null,
    createdAt: transfer.createdAt.toISOString(),
  }));
}

async function getFundByTab(organizationId: string, tab: FundTab) {
  return prisma.fund.findUnique({
    where: {
      organizationId_code: {
        organizationId,
        code: TAB_TO_FUND_CODE[tab],
      },
    },
  });
}

export async function createTransfer(input: CreateTransferInput) {
  try {
    const userId = await assertCanWrite();
    const data = parseInput(createTransferSchema, input);
    const organizationId = await getOrganizationId();

    const fromFund = await getFundByTab(organizationId, data.fromFund);
    const toFund = await getFundByTab(organizationId, data.toFund);

    if (!fromFund || !toFund) {
      throw new Error("Fondos no encontrados.");
    }

    const amount = new Prisma.Decimal(Math.abs(data.amount).toFixed(2));
    const date = new Date(data.date);
    const description =
      data.description ||
      `Transferencia ${fromFund.name} → ${toFund.name}`;

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          organizationId,
          fromFundId: fromFund.id,
          toFundId: toFund.id,
          amount,
          date,
          description,
          createdById: userId,
        },
      });

      await tx.movement.createMany({
        data: [
          {
            organizationId,
            fundId: fromFund.id,
            transferId: created.id,
            date,
            amount,
            movementType: MovementType.EXPENSE,
            description: `${description} (salida)`,
            createdById: userId,
          },
          {
            organizationId,
            fundId: toFund.id,
            transferId: created.id,
            date,
            amount,
            movementType: MovementType.INCOME,
            description: `${description} (entrada)`,
            createdById: userId,
          },
        ],
      });

      return created;
    });

    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action: AuditAction.CREATE,
        entity: "transfers",
        entityId: transfer.id,
        newValues: {
          fromFund: fromFund.code,
          toFund: toFund.code,
          amount: amount.toString(),
          date: date.toISOString(),
          description,
        },
      },
    });

    if (process.env.WRITE_TO_SHEETS !== "false") {
      try {
        await exportRecordToSheets({
          date: data.date,
          amount: Number(amount),
          type: "Egreso",
          description: `${description} (transferencia salida)`,
          category: data.fromFund,
        });
        await exportRecordToSheets({
          date: data.date,
          amount: Number(amount),
          type: "Ingreso",
          description: `${description} (transferencia entrada)`,
          category: data.toFund,
        });
      } catch (exportError) {
        console.error("Exportación a Sheets falló (transferencia guardada en BD):", exportError);
      }
    }

    revalidatePath("/transfers");
    revalidatePath("/dashboard");
    revalidatePath("/records");
    revalidatePath("/reconciliation");

    return { success: true as const, transferId: transfer.id };
  } catch (error) {
    console.error("Error creating transfer:", error);
    return {
      success: false as const,
      error: toClientError(error),
    };
  }
}
