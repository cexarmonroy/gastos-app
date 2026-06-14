const SHEET_ID = process.env.GOOGLE_SHEET_ID ?? "";
const CAJA_CHICA_GID = process.env.CAJA_CHICA_GID ?? "";
const FONDO_AHORRO_GID = process.env.FONDO_AHORRO_GID ?? "";

export interface SheetExportRecord {
  date: string;
  description: string;
  amount: number;
  type: "Ingreso" | "Egreso";
  category: "caja_chica" | "fondo_ahorro";
}

/** Exporta un movimiento a Google Sheets (respaldo/rendición). Función interna, no expuesta como Server Action. */
export async function exportRecordToSheets(data: SheetExportRecord) {
  if (!SHEET_ID) {
    throw new Error("GOOGLE_SHEET_ID no configurado.");
  }

  const { google } = await import("googleapis");

  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  const sheets = google.sheets({ version: "v4", auth });

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const gidToUpdate = data.category === "caja_chica" ? CAJA_CHICA_GID : FONDO_AHORRO_GID;
  const sheet = spreadsheet.data.sheets?.find(
    (s) => s.properties?.sheetId?.toString() === gidToUpdate
  );

  if (!sheet?.properties?.title) {
    throw new Error(`No se encontró la pestaña con GID ${gidToUpdate}`);
  }

  const sheetTitle = sheet.properties.title;
  const checkResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetTitle}!A:A`,
  });

  const lastRow = checkResponse.data.values ? checkResponse.data.values.length : 0;
  const nextRow = lastRow + 1;
  const finalAmount = data.type === "Egreso" ? -Math.abs(data.amount) : Math.abs(data.amount);
  const dateObj = new Date(data.date);
  const formattedDate = `${dateObj.getDate().toString().padStart(2, "0")}/${(dateObj.getMonth() + 1).toString().padStart(2, "0")}/${dateObj.getFullYear()}`;

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetTitle}!A${nextRow}:D${nextRow}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [[formattedDate, finalAmount.toLocaleString("es-CL"), data.type, data.description]],
    },
  });
}
