export type SheetFundKey = "caja_chica" | "fondo_ahorro";

export interface ParsedSheetRow {
  date: Date;
  amount: number;
  movementType: "INCOME" | "EXPENSE";
  description: string;
  rowIndex: number;
}

function normalizeColumnKey(key: string): string {
  return key
    .trim()
    .toLowerCase()
    .replace(/├│/g, "ó")
    .replace(/├í/g, "á")
    .replace(/├®/g, "é")
    .replace(/├¡/g, "í")
    .replace(/├║/g, "ú")
    .replace(/├▒/g, "ñ")
    .replace(/├ü/g, "ü");
}

function getColumnValue(row: Record<string, string>, possibleNames: string[]): string | undefined {
  const keys = Object.keys(row);

  for (const key of keys) {
    const normalizedKey = normalizeColumnKey(key);

    for (const name of possibleNames) {
      const normalizedName = name.trim().toLowerCase();
      if (
        normalizedKey === normalizedName ||
        normalizedKey.includes(normalizedName) ||
        normalizedName.includes(normalizedKey)
      ) {
        return row[key];
      }
    }
  }

  return undefined;
}

export function parseChileanAmount(rawAmount: string | number): number {
  let cleanAmountStr = rawAmount
    .toString()
    .replace(/[^0-9,\.-]+/g, "")
    .trim();

  if (cleanAmountStr.includes(",")) {
    cleanAmountStr = cleanAmountStr.replace(/\./g, "").replace(",", ".");
  } else if (cleanAmountStr.includes(".")) {
    const parts = cleanAmountStr.split(".");
    const lastPart = parts[parts.length - 1];

    if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3)) {
      cleanAmountStr = cleanAmountStr.replace(/\./g, "");
    } else if (parts.length === 2 && lastPart.length <= 2) {
      // decimal
    } else {
      cleanAmountStr = cleanAmountStr.replace(/\./g, "");
    }
  }

  const parsed = parseFloat(cleanAmountStr);
  return Number.isNaN(parsed) ? 0 : parsed;
}

function parseSheetDate(rawDate: string): Date | null {
  if (!rawDate || !rawDate.includes("/")) return null;

  const parts = rawDate.split("/");
  if (parts.length !== 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  if (Number.isNaN(day) || Number.isNaN(month) || Number.isNaN(year)) return null;

  return new Date(year, month, day);
}

function normalizeMovementType(rawType: string, rawAmount: number): "INCOME" | "EXPENSE" {
  const normalized = rawType.trim().toLowerCase();

  if (normalized.includes("egreso") || rawAmount < 0) {
    return "EXPENSE";
  }

  if (normalized.includes("ingreso") || rawAmount >= 0) {
    return "INCOME";
  }

  return rawAmount < 0 ? "EXPENSE" : "INCOME";
}

export function parseSheetRows(rows: Record<string, string>[]): ParsedSheetRow[] {
  const parsedRows: ParsedSheetRow[] = [];

  rows.forEach((row, index) => {
    const rawDate = getColumnValue(row, ["fechas", "fecha", "date"]) || "";
    const rawAmount = getColumnValue(row, ["monto", "amount"]) || "0";
    const rawType =
      getColumnValue(row, ["ingreso/egreso", "ingreso egreso", "tipo", "type"]) || "Ingreso";
    const rawDesc = getColumnValue(row, ["descripción", "descripcion", "description", "desc"]) || "";

    if (!rawDate && (!rawAmount || rawAmount === "0")) {
      return;
    }

    const date = parseSheetDate(rawDate);
    if (!date) {
      return;
    }

    const signedAmount = parseChileanAmount(rawAmount);
    const movementType = normalizeMovementType(rawType, signedAmount);

    parsedRows.push({
      date,
      amount: Math.abs(signedAmount),
      movementType,
      description: rawDesc.trim(),
      rowIndex: index + 2,
    });
  });

  return parsedRows;
}

export function buildExternalRef(sheetId: string, gid: string, rowIndex: number): string {
  return `sheets:${sheetId}:${gid}:${rowIndex}`;
}
