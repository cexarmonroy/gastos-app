/**
 * Importa movimientos históricos desde Google Sheets hacia PostgreSQL.
 *
 * Uso:
 *   npm run db:seed
 *   npm run import:sheets
 *
 * Requiere DATABASE_URL en .env (o en el entorno).
 */

import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import Papa from "papaparse";
import {
  AuditAction,
  MovementType,
  Prisma,
  PrismaClient,
  ReconciliationStatus,
} from "@prisma/client";
import { inferCategoryCode } from "../lib/category-inference";
import {
  buildExternalRef,
  parseSheetRows,
  type SheetFundKey,
} from "../lib/sheet-parser";

const ORG_SLUG = "cgpa";
const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "";
const CAJA_CHICA_GID = process.env.CAJA_CHICA_GID ?? "";
const FONDO_AHORRO_GID = process.env.FONDO_AHORRO_GID ?? "";

const FUND_CODE_BY_SHEET: Record<SheetFundKey, string> = {
  caja_chica: "CAJA_CHICA",
  fondo_ahorro: "FONDO_AHORRO",
};

function loadEnvFile() {
  const envPath = resolve(process.cwd(), ".env");
  if (!existsSync(envPath)) return;

  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function signedAmount(movementType: MovementType, amount: number): Prisma.Decimal {
  const value = movementType === MovementType.EXPENSE ? -Math.abs(amount) : Math.abs(amount);
  return new Prisma.Decimal(value.toFixed(2));
}

async function fetchCsv(url: string): Promise<string | null> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    console.error(`Error HTTP ${response.status} al obtener ${url}`);
    return null;
  }

  const csvText = await response.text();
  if (!csvText.trim()) {
    console.warn(`CSV vacío: ${url}`);
    return null;
  }

  return csvText;
}

async function importFundSheet(
  prisma: PrismaClient,
  params: {
    organizationId: string;
    fundId: string;
    categoryMap: Map<string, string>;
    sheetKey: SheetFundKey;
    gid: string;
    url: string;
  }
) {
  const csvText = await fetchCsv(params.url);
  if (!csvText) {
    return { imported: 0, skipped: 0, sheetBalance: new Prisma.Decimal(0) };
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: "greedy",
  });

  const rows = parseSheetRows(parsed.data);
  let imported = 0;
  let skipped = 0;
  let sheetBalance = new Prisma.Decimal(0);

  for (const row of rows) {
    const externalRef = buildExternalRef(SHEET_ID, params.gid, row.rowIndex);
    const existing = await prisma.movement.findUnique({
      where: {
        organizationId_externalRef: {
          organizationId: params.organizationId,
          externalRef,
        },
      },
      select: { id: true },
    });

    const categoryCode = inferCategoryCode(row.description, row.movementType);
    const fallbackCode = row.movementType === MovementType.EXPENSE ? "OTROS_GASTO" : "OTROS";
    const categoryId =
      params.categoryMap.get(categoryCode) || params.categoryMap.get(fallbackCode);

    const signed = signedAmount(row.movementType, row.amount);
    sheetBalance = sheetBalance.add(signed);

    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.movement.create({
      data: {
        organizationId: params.organizationId,
        fundId: params.fundId,
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

  console.log(
    `[${params.sheetKey}] filas=${rows.length} importadas=${imported} omitidas=${skipped} saldo=${sheetBalance.toFixed(0)}`
  );

  return { imported, skipped, sheetBalance };
}

async function computeDbBalance(
  prisma: PrismaClient,
  organizationId: string,
  fundId: string
): Promise<Prisma.Decimal> {
  const movements = await prisma.movement.findMany({
    where: {
      organizationId,
      fundId,
      deletedAt: null,
    },
    select: {
      amount: true,
      movementType: true,
    },
  });

  return movements.reduce((total, movement) => {
    const signed =
      movement.movementType === MovementType.EXPENSE
        ? movement.amount.mul(-1)
        : movement.amount;
    return total.add(signed);
  }, new Prisma.Decimal(0));
}

async function main() {
  loadEnvFile();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL no está definida. Configura tu archivo .env.");
  }

  const prisma = new PrismaClient();

  try {
    const organization = await prisma.organization.findUnique({
      where: { slug: ORG_SLUG },
    });

    if (!organization) {
      throw new Error(`Organización '${ORG_SLUG}' no encontrada. Ejecuta primero: npm run db:seed`);
    }

    const funds = await prisma.fund.findMany({
      where: { organizationId: organization.id, active: true },
    });

    const fundByCode = new Map(funds.map((fund) => [fund.code, fund]));
    const categories = await prisma.category.findMany({
      where: { organizationId: organization.id, active: true },
    });
    const categoryMap = new Map(categories.map((category) => [category.code, category.id]));

    const sources: Array<{ sheetKey: SheetFundKey; gid: string; url: string }> = [
      {
        sheetKey: "caja_chica",
        gid: CAJA_CHICA_GID,
        url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${CAJA_CHICA_GID}`,
      },
    ];

    if (FONDO_AHORRO_GID !== "0") {
      sources.push({
        sheetKey: "fondo_ahorro",
        gid: FONDO_AHORRO_GID,
        url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${FONDO_AHORRO_GID}`,
      });
    }

    let totalImported = 0;
    let totalSkipped = 0;

    for (const source of sources) {
      const fundCode = FUND_CODE_BY_SHEET[source.sheetKey];
      const fund = fundByCode.get(fundCode);

      if (!fund) {
        console.warn(`Fondo ${fundCode} no encontrado, saltando ${source.sheetKey}`);
        continue;
      }

      const result = await importFundSheet(prisma, {
        organizationId: organization.id,
        fundId: fund.id,
        categoryMap,
        sheetKey: source.sheetKey,
        gid: source.gid,
        url: source.url,
      });

      totalImported += result.imported;
      totalSkipped += result.skipped;

      const dbBalance = await computeDbBalance(prisma, organization.id, fund.id);
      const delta = result.sheetBalance.sub(dbBalance);
      const status =
        delta.abs().lessThanOrEqualTo(new Prisma.Decimal("0.01"))
          ? ReconciliationStatus.MATCH
          : ReconciliationStatus.MISMATCH;

      await prisma.reconciliationLog.create({
        data: {
          organizationId: organization.id,
          fundId: fund.id,
          sheetBalance: result.sheetBalance,
          dbBalance,
          delta,
          status,
          notes: `Importación automática desde Google Sheets (${source.sheetKey})`,
        },
      });

      await prisma.auditLog.create({
        data: {
          organizationId: organization.id,
          action: AuditAction.IMPORT,
          entity: "movements",
          entityId: fund.id,
          metadata: {
            sheetKey: source.sheetKey,
            imported: result.imported,
            skipped: result.skipped,
            sheetBalance: result.sheetBalance.toString(),
            dbBalance: dbBalance.toString(),
            delta: delta.toString(),
            status,
          },
        },
      });

      console.log(
        `[${fund.name}] conciliación: sheet=${result.sheetBalance.toFixed(0)} db=${dbBalance.toFixed(0)} delta=${delta.toFixed(0)} status=${status}`
      );
    }

    console.log("");
    console.log(`Importación finalizada. Nuevos=${totalImported} Omitidos=${totalSkipped}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Error en importación:", error);
  process.exit(1);
});
