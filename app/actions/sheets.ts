"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { assertAuthenticated, assertCanWrite, assertRole } from "@/lib/auth-guards";
import { exportRecordToSheets, type SheetExportRecord } from "@/lib/finance/sheets-export";

const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "";
const INSCRIPCIONES_ID = process.env.INSCRIPCIONES_SHEET_ID ?? "";
const FONDO_AHORRO_GID = process.env.FONDO_AHORRO_GID ?? "";

/** @deprecated Usar createMovement en app/actions/movements.ts */
export async function addRecord(data: SheetExportRecord & { tags?: string }) {
  try {
    await assertCanWrite();
    await exportRecordToSheets(data);
    revalidatePath("/dashboard");
    revalidatePath("/records");
    return { success: true };
  } catch (error) {
    console.error("Error adding record to Sheets:", error);
    return { success: false, error: "No se pudo agregar el registro." };
  }
}

export async function fetchRecordsData() {
  await assertAuthenticated();

  if (!SHEET_ID) {
    console.error("GOOGLE_SHEET_ID no configurado.");
    return [];
  }

  try {
    const urls = [
      { url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`, category: "caja_chica" },
      { url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${FONDO_AHORRO_GID}`, category: "fondo_ahorro" },
    ];

    const allRecords: Array<{
      id: string;
      date: string;
      amount: number;
      type: string;
      description: string;
      status: string;
      tags: string;
      category: string;
    }> = [];
    let idCounter = 1;
    const csvDataByCategory: Record<string, string> = {};

    for (const { url, category } of urls) {
      if (category === "fondo_ahorro" && FONDO_AHORRO_GID === "0") {
        continue;
      }

      const res = await fetch(url, { next: { revalidate: 0 }, cache: "no-store" });
      if (!res.ok) {
        console.error(`Error al obtener ${category}: Status ${res.status}`);
        continue;
      }

      const csvText = await res.text();
      if (!csvText || csvText.trim().length === 0) {
        continue;
      }

      const existingCategory = Object.keys(csvDataByCategory).find(
        (cat) => csvDataByCategory[cat] === csvText
      );
      if (existingCategory && existingCategory !== category) {
        console.error(`[${category}] Datos duplicados con ${existingCategory}.`);
      }
      csvDataByCategory[category] = csvText;

      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy" });
      if (!parsed.data || parsed.data.length === 0) {
        continue;
      }

      for (const row of parsed.data as Record<string, string>[]) {
        const keys = Object.keys(row);

        const getVal = (possibleNames: string[]) => {
          for (const k of keys) {
            const normalizedKey = k.trim().toLowerCase()
              .replace(/├│/g, "ó")
              .replace(/├í/g, "á")
              .replace(/├®/g, "é")
              .replace(/├¡/g, "í")
              .replace(/├║/g, "ú")
              .replace(/├▒/g, "ñ")
              .replace(/├ü/g, "ü");

            for (const name of possibleNames) {
              const normalizedName = name.trim().toLowerCase();
              if (normalizedKey === normalizedName || normalizedKey.includes(normalizedName) || normalizedName.includes(normalizedKey)) {
                return row[k];
              }
            }
          }
          return undefined;
        };

        const rawDate = getVal(["fechas", "fecha", "date"]) || "";
        const rawAmount = getVal(["monto", "amount"]) || "0";
        const rawType = getVal(["ingreso/egreso", "ingreso egreso", "tipo", "type"]) || "Ingreso";
        const rawDesc = getVal(["descripción", "descripcion", "description", "desc"]) || "";

        if (!rawDate && (!rawAmount || rawAmount === "0")) continue;

        let isoDate = new Date().toISOString();
        if (rawDate && typeof rawDate === "string" && rawDate.includes("/")) {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
            const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
            isoDate = dateObj.toISOString();
          }
        }

        let cleanAmountStr = rawAmount.toString()
          .replace(/[^0-9,\.-]+/g, "")
          .trim();

        if (cleanAmountStr.includes(",")) {
          cleanAmountStr = cleanAmountStr.replace(/\./g, "").replace(",", ".");
        } else if (cleanAmountStr.includes(".")) {
          const parts = cleanAmountStr.split(".");
          const lastPart = parts[parts.length - 1];

          if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3)) {
            cleanAmountStr = cleanAmountStr.replace(/\./g, "");
          }
        }

        let amountClean = parseFloat(cleanAmountStr);
        if (isNaN(amountClean)) amountClean = 0;

        let normalizedType = rawType.trim();
        if (normalizedType) {
          normalizedType = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1).toLowerCase();
          if (normalizedType.toLowerCase().includes("ingreso")) {
            normalizedType = "Ingreso";
          } else if (normalizedType.toLowerCase().includes("egreso")) {
            normalizedType = "Egreso";
          }
        } else {
          normalizedType = "Ingreso";
        }

        allRecords.push({
          id: `${category}-${idCounter}`,
          date: isoDate,
          amount: amountClean,
          type: normalizedType,
          description: rawDesc.trim(),
          status: "COMPLETED",
          tags: JSON.stringify(["sheet"]),
          category,
        });
        idCounter++;
      }
    }

    allRecords.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allRecords;
  } catch (error) {
    console.error("Error al obtener SpreadSheet:", error);
    return [];
  }
}

export async function getInscripcionesSheets() {
  await assertRole(Role.ADMIN, Role.DIRECTIVA);

  if (!INSCRIPCIONES_ID) {
    console.error("INSCRIPCIONES_SHEET_ID no configurado.");
    return [];
  }

  try {
    const { google } = await import("googleapis");
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: INSCRIPCIONES_ID,
    });

    return spreadsheet.data.sheets?.map((s) => s.properties?.title || "") || [];
  } catch (error) {
    console.error("Error fetching sheet list:", error);
    return [];
  }
}

export async function getInscripcionesData(sheetName: string) {
  await assertRole(Role.ADMIN, Role.DIRECTIVA);

  if (!INSCRIPCIONES_ID) {
    console.error("INSCRIPCIONES_SHEET_ID no configurado.");
    return [];
  }

  try {
    const url = `https://docs.google.com/spreadsheets/d/${INSCRIPCIONES_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(sheetName)}`;

    const res = await fetch(url, { next: { revalidate: 0 }, cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo obtener la información: ${res.statusText}`);

    const csvText = await res.text();
    const parsed = Papa.parse(csvText, {
      header: false,
      skipEmptyLines: "greedy",
    });

    if (!parsed.data || parsed.data.length === 0) return [];

    const rows = parsed.data as string[][];

    const firstRowStr = rows[0].join(" ").toLowerCase();
    const headersKeys = ["apellido", "nombre", "fecha", "apoderado", "mail", "fono"];
    const hasHeader = headersKeys.some((key) => firstRowStr.includes(key));

    const startIndex = hasHeader ? 1 : 0;

    return rows.slice(startIndex).map((row, index) => ({
      id: `${sheetName}-${index}`,
      apellidoPaterno: row[0] || "",
      apellidoMaterno: row[1] || "",
      nombres: row[2] || "",
      fecha: row[3] || "",
      apoderado: row[4] || "",
      mail: row[5] || "",
      profesion: row[6] || "",
      fono: row[7] || "",
    })).filter((r) => r.apellidoPaterno || r.nombres || r.apellidoMaterno);
  } catch (error) {
    console.error(`Error fetching data for sheet ${sheetName}:`, error);
    return [];
  }
}
