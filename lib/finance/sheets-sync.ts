import Papa from "papaparse";
import { MovementType, Prisma, type PrismaClient } from "@prisma/client";
import { inferCategoryCode } from "@/lib/category-inference";
import { ORG_SLUG, TAB_TO_FUND_CODE, type FundTab } from "@/lib/finance/types";
import { buildExternalRef, parseSheetRows, type SheetFundKey } from "@/lib/sheet-parser";

export const SHEET_ID = process.env.GOOGLE_SHEET_ID || "1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q";
export const CAJA_CHICA_GID = process.env.CAJA_CHICA_GID || "968865594";
export const FONDO_AHORRO_GID = process.env.FONDO_AHORRO_GID || "410879135";

const FUND_CODE_BY_SHEET: Record<SheetFundKey, string> = {
  caja_chica: "CAJA_CHICA",
  fondo_ahorro: "FONDO_AHORRO",
};

export interface SheetSource {
  sheetKey: SheetFundKey;
  fundTab: FundTab;
  fundCode: string;
  gid: string;
  url: string;
}

export interface ReconciliationFundResult {
  fundId: string;
  fundName: string;
  fundCode: string;
  sheetKey: SheetFundKey;
  sheetBalance: number;
  dbBalance: number;
  delta: number;
  status: "MATCH" | "MISMATCH";
  rowCount: number;
}

export function getSheetSources(): SheetSource[] {
  const sources: SheetSource[] = [
    {
      sheetKey: "caja_chica",
      fundTab: "caja_chica",
      fundCode: "CAJA_CHICA",
      gid: CAJA_CHICA_GID,
      url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CAJA_CHICA_GID}`,
    },
  ];

  if (FONDO_AHORRO_GID !== "0") {
    sources.push({
      sheetKey: "fondo_ahorro",
      fundTab: "fondo_ahorro",
      fundCode: "FONDO_AHORRO",
      gid: FONDO_AHORRO_GID,
      url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${FONDO_AHORRO_GID}`,
    });
  }

  return sources;
}

async function fetchSheetCsv(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) return null;
  const csvText = await response.text();
  return csvText.trim() ? csvText : null;
}

function signedAmount(movementType: MovementType, amount: number): number {
  return movementType === MovementType.EXPENSE ? -Math.abs(amount) : Math.abs(amount);
}

export function computeBalanceFromCsv(csvText: string): { balance: number; rowCount: number } {
  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const rows = parseSheetRows(parsed.data);
  const balance = rows.reduce(
    (total, row) => total + signedAmount(row.movementType, row.amount),
    0
  );

  return { balance, rowCount: rows.length };
}

export async function computeDbBalance(
  prisma: PrismaClient,
  organizationId: string,
  fundId: string
): Promise<number> {
  const movements = await prisma.movement.findMany({
    where: { organizationId, fundId, deletedAt: null },
    select: { amount: true, movementType: true },
  });

  return movements.reduce((total, movement) => {
    const value = Number(movement.amount);
    return total + signedAmount(movement.movementType, value);
  }, 0);
}

export async function reconcileOrganizationFunds(
  prisma: PrismaClient,
  organizationId: string
): Promise<ReconciliationFundResult[]> {
  const funds = await prisma.fund.findMany({
    where: { organizationId, active: true },
  });
  const fundByCode = new Map(funds.map((fund) => [fund.code, fund]));
  const results: ReconciliationFundResult[] = [];

  for (const source of getSheetSources()) {
    const fund = fundByCode.get(source.fundCode);
    if (!fund) continue;

    const csvText = await fetchSheetCsv(source.url);
    const sheetData = csvText ? computeBalanceFromCsv(csvText) : { balance: 0, rowCount: 0 };
    const dbBalance = await computeDbBalance(prisma, organizationId, fund.id);
    const delta = sheetData.balance - dbBalance;
    const status = Math.abs(delta) <= 0.01 ? "MATCH" : "MISMATCH";

    results.push({
      fundId: fund.id,
      fundName: fund.name,
      fundCode: fund.code,
      sheetKey: source.sheetKey,
      sheetBalance: sheetData.balance,
      dbBalance,
      delta,
      status,
      rowCount: sheetData.rowCount,
    });
  }

  return results;
}

export async function importMissingMovementsFromSheets(
  prisma: PrismaClient,
  organizationId: string
): Promise<{ imported: number; skipped: number }> {
  const categories = await prisma.category.findMany({
    where: { organizationId, active: true },
  });
  const categoryMap = new Map(categories.map((category) => [category.code, category.id]));

  const funds = await prisma.fund.findMany({
    where: { organizationId, active: true },
  });
  const fundByCode = new Map(funds.map((fund) => [fund.code, fund]));

  let imported = 0;
  let skipped = 0;

  for (const source of getSheetSources()) {
    const fund = fundByCode.get(source.fundCode);
    if (!fund) continue;

    const csvText = await fetchSheetCsv(source.url);
    if (!csvText) continue;

    const parsed = Papa.parse<Record<string, string>>(csvText, {
      header: true,
      skipEmptyLines: "greedy",
    });

    for (const row of parseSheetRows(parsed.data)) {
      const externalRef = buildExternalRef(SHEET_ID, source.gid, row.rowIndex);
      const existing = await prisma.movement.findUnique({
        where: {
          organizationId_externalRef: { organizationId, externalRef },
        },
        select: { id: true },
      });

      if (existing) {
        skipped += 1;
        continue;
      }

      const categoryCode = inferCategoryCode(row.description, row.movementType);
      const fallbackCode = row.movementType === MovementType.EXPENSE ? "OTROS_GASTO" : "OTROS";
      const categoryId =
        categoryMap.get(categoryCode) || categoryMap.get(fallbackCode) || null;

      await prisma.movement.create({
        data: {
          organizationId,
          fundId: fund.id,
          categoryId,
          date: row.date,
          amount: new Prisma.Decimal(row.amount.toFixed(2)),
          movementType: row.movementType,
          description: row.description || null,
          externalRef,
        },
      });

      imported += 1;
    }
  }

  return { imported, skipped };
}

export { ORG_SLUG, TAB_TO_FUND_CODE, FUND_CODE_BY_SHEET };
