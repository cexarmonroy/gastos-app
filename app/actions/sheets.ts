"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";

const SHEET_ID = "1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q";
const CAJA_CHICA_GID = "968865594"; 
const FONDO_AHORRO_GID = process.env.FONDO_AHORRO_GID || "410879135"; 

interface NewRecord {
  date: string;
  description: string;
  amount: number;
  type: "Ingreso" | "Egreso";
  category: "caja_chica" | "fondo_ahorro";
  tags?: string;
}

export async function addRecord(data: NewRecord) {
  try {
    const { google } = await import("googleapis");

    // Service Account Auth using dynamic import and constructor object
    const auth = new google.auth.JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    
    // Obtener nombres de pestañas por GID
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });
    
    const gidToUpdate = data.category === "caja_chica" ? CAJA_CHICA_GID : FONDO_AHORRO_GID;
    const sheet = spreadsheet.data.sheets?.find(s => s.properties?.sheetId?.toString() === gidToUpdate);
    
    if (!sheet || !sheet.properties?.title) {
      throw new Error(`No se encontró la pestaña con GID ${gidToUpdate}`);
    }

    const sheetTitle = sheet.properties.title;

    // Encontrar la primera fila vacía en la columna A para evitar saltarse filas con fórmulas
    const checkRange = `${sheetTitle}!A:A`;
    const checkResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: checkRange,
    });
    
    const lastRow = checkResponse.data.values ? checkResponse.data.values.length : 0;
    const nextRow = lastRow + 1;
    const range = `${sheetTitle}!A${nextRow}:D${nextRow}`;
    
    // Formatear monto según tipo (negativo para Egresos)
    const finalAmount = data.type === "Egreso" ? -Math.abs(data.amount) : Math.abs(data.amount);
    
    // Formatear fecha para el CSV (dd/mm/yyyy)
    const dateObj = new Date(data.date);
    const formattedDate = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')}/${dateObj.getFullYear()}`;

    // Orden correcto según la planilla: Fecha | Monto | Tipo | Descripción
    const values = [
      [
        formattedDate,
        finalAmount.toLocaleString('es-CL'),
        data.type,
        data.description
      ]
    ];

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values,
      },
    });

    revalidatePath("/dashboard");
    revalidatePath("/records");
    
    return { success: true };
  } catch (error) {
    console.error("Error adding record to Sheets:", error);
    return { success: false, error: (error as any).message };
  }
}

export async function fetchRecordsData() {
  try {
    const urls = [
      // Caja chica: usar URL sin GID para obtener la primera pestaña por defecto
      { url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`, category: "caja_chica" },
      // Fondo de ahorro: usar GID específico para obtener su pestaña
      { url: `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${FONDO_AHORRO_GID}`, category: "fondo_ahorro" }
    ];

    let allRecords: any[] = [];
    let idCounter = 1;
    const csvDataByCategory: { [key: string]: string } = {}; // Para comparar y detectar duplicados

    for (const { url, category } of urls) {
      // Si ambos tienen GID 0, evitamos la duplicación de datos (sucede cuando FONDO_AHORRO no ha sido proveído)
      if (category === "fondo_ahorro" && FONDO_AHORRO_GID === "0") {
        continue;
      }

      const res = await fetch(url, { next: { revalidate: 0 }, cache: 'no-store' });
      if (!res.ok) {
        console.error(`Error al obtener ${category}: Status ${res.status}`);
        continue;
      }

      const csvText = await res.text();
      
      // Verificar que el CSV no esté vacío
      if (!csvText || csvText.trim().length === 0) {
        console.warn(`[${category}] CSV vacío, saltando...`);
        continue;
      }
      
      // Verificar si este CSV es idéntico a otro ya procesado (detectar duplicados)
      const existingCategory = Object.keys(csvDataByCategory).find(
        cat => csvDataByCategory[cat] === csvText
      );
      if (existingCategory && existingCategory !== category) {
        console.error(`[${category}] ⚠️ ADVERTENCIA: Los datos son idénticos a ${existingCategory}. URL: ${url}`);
        console.error(`[${category}] Esto significa que ambas URLs están devolviendo los mismos datos.`);
        // Continuar procesando pero con advertencia
      }
      csvDataByCategory[category] = csvText;
      
      const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: "greedy" });
      
      // Verificar que hay datos válidos
      if (!parsed.data || parsed.data.length === 0) {
        console.warn(`[${category}] No hay datos válidos en el CSV, saltando...`);
        continue;
      }
      
      // Debug: verificar que estamos obteniendo datos diferentes
      const firstRow = parsed.data[0] as any;
      const sampleData = firstRow ? {
        fecha: Object.keys(firstRow).find(k => k.toLowerCase().includes('fecha')) ? firstRow[Object.keys(firstRow).find(k => k.toLowerCase().includes('fecha'))!] : 'N/A',
        monto: Object.keys(firstRow).find(k => k.toLowerCase().includes('monto')) ? firstRow[Object.keys(firstRow).find(k => k.toLowerCase().includes('monto'))!] : 'N/A',
        descripcion: Object.keys(firstRow).find(k => k.toLowerCase().includes('descrip')) ? firstRow[Object.keys(firstRow).find(k => k.toLowerCase().includes('descrip'))!] : 'N/A'
      } : null;
      console.log(`[${category}] URL: ${url}`);
      console.log(`[${category}] Filas obtenidas: ${parsed.data.length}, Sample:`, sampleData);
      console.log(`[${category}] Headers encontrados:`, Object.keys(firstRow || {}));

      let recordsAdded = 0;
      for (const row of parsed.data as any[]) {
        const keys = Object.keys(row);
        
        // Función mejorada que normaliza los nombres de columnas (trim, lowercase, maneja caracteres especiales)
        const getVal = (possibleNames: string[]) => {
          for (const k of keys) {
            const normalizedKey = k.trim().toLowerCase()
              .replace(/├│/g, 'ó')
              .replace(/├í/g, 'á')
              .replace(/├®/g, 'é')
              .replace(/├¡/g, 'í')
              .replace(/├║/g, 'ú')
              .replace(/├▒/g, 'ñ')
              .replace(/├ü/g, 'ü');
            
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
        // Buscar tipo con diferentes variantes (mayúsculas, minúsculas, con/sin barra)
        const rawType = getVal(["ingreso/egreso", "ingreso egreso", "tipo", "type"]) || "Ingreso";
        const rawDesc = getVal(["descripción", "descripcion", "description", "desc"]) || "";

        if (!rawDate && (!rawAmount || rawAmount === "0")) continue;

        let isoDate = new Date().toISOString();
        if (rawDate && typeof rawDate === 'string' && rawDate.includes("/")) {
          const parts = rawDate.split("/");
          if (parts.length === 3) {
             const dateObj = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
             isoDate = dateObj.toISOString();
          }
        }

        // Limpiar monto: remover símbolos, espacios, y manejar formato chileno (puntos como separadores de miles)
        let cleanAmountStr = rawAmount.toString()
          .replace(/[^0-9,\.-]+/g, "") // Remover símbolos como $
          .trim();
        
        // Detectar formato: si tiene coma, es decimal; si solo tiene puntos, son separadores de miles
        if (cleanAmountStr.includes(",")) {
          // Formato con coma decimal (formato chileno): remover puntos (miles) y convertir coma a punto
          cleanAmountStr = cleanAmountStr.replace(/\./g, "").replace(",", ".");
        } else if (cleanAmountStr.includes(".")) {
          // Solo puntos: en formato chileno, los puntos son separadores de miles si hay múltiples
          // o si el grupo después del punto tiene 3 dígitos
          const parts = cleanAmountStr.split(".");
          const lastPart = parts[parts.length - 1];
          
          // Si hay múltiples puntos o el último grupo tiene 3 dígitos, son separadores de miles
          if (parts.length > 2 || (parts.length === 2 && lastPart.length === 3)) {
            // Son separadores de miles: remover todos los puntos
            cleanAmountStr = cleanAmountStr.replace(/\./g, "");
          } else if (parts.length === 2 && lastPart.length <= 2) {
            // Probablemente es decimal: mantener el punto
            // No hacer nada, ya está bien
          } else {
            // Por defecto, asumir que son separadores de miles (formato chileno común)
            cleanAmountStr = cleanAmountStr.replace(/\./g, "");
          }
        }
        
        let amountClean = parseFloat(cleanAmountStr);
        if (isNaN(amountClean)) amountClean = 0;

        // Normalizar el tipo: capitalizar primera letra si es necesario
        let normalizedType = rawType.trim();
        if (normalizedType) {
          normalizedType = normalizedType.charAt(0).toUpperCase() + normalizedType.slice(1).toLowerCase();
          // Asegurar que sea "Ingreso" o "Egreso"
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
          category
        });
        idCounter++;
        recordsAdded++;
      }
      
      console.log(`[${category}] Registros agregados: ${recordsAdded}`);
    }

    allRecords.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return allRecords;
  } catch (error) {
    console.error("Error al obtener SpreadSheet:", error);
    return [];
  }
}
