const Papa = require("papaparse");

const SHEET_ID = "1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q";

// GIDs conocidos para probar
const GIDS_TO_TEST = [
  "0", // Primera pestaña (Caja Chica)
  "968865594", // GID actual configurado
  "42426863", // Otro GID que vimos en los tests
];

// Contenido característico de Fondo de Ahorro que el usuario mencionó
const FONDO_AHORRO_MARKERS = [
  "Fondo inicio de año",
  "pasto sintetico",
  "Fondo caja chica",
  "5.073.033", // Monto característico
  "3.000.000", // Saldo final característico
];

async function checkGid(gid) {
  const url = gid === "0" 
    ? `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv`
    : `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`GID ${gid}: Error ${res.status}`);
      return null;
    }
    
    const text = await res.text();
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    
    if (!parsed.data || parsed.data.length === 0) {
      console.log(`GID ${gid}: Sin datos`);
      return null;
    }
    
    // Buscar marcadores de Fondo de Ahorro en el contenido
    const csvLower = text.toLowerCase();
    const foundMarkers = FONDO_AHORRO_MARKERS.filter(marker => 
      csvLower.includes(marker.toLowerCase())
    );
    
    // Verificar estructura de columnas
    const firstRow = parsed.data[0];
    const hasSaldoAcumulado = Object.keys(firstRow).some(k => 
      k.toLowerCase().includes('saldo') && k.toLowerCase().includes('acumulado')
    );
    
    console.log(`\n--- GID: ${gid} ---`);
    console.log(`Filas: ${parsed.data.length}`);
    console.log(`Marcadores encontrados: ${foundMarkers.length}/${FONDO_AHORRO_MARKERS.length}`);
    console.log(`Tiene columna "Saldo Acumulado": ${hasSaldoAcumulado}`);
    console.log(`Headers:`, Object.keys(firstRow));
    
    if (foundMarkers.length >= 2 || hasSaldoAcumulado) {
      console.log(`✅ ESTE PARECE SER EL GID CORRECTO PARA FONDO DE AHORRO!`);
      console.log(`Primera fila:`, firstRow);
      return gid;
    }
    
    return null;
  } catch (err) {
    console.log(`GID ${gid}: Error - ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("Buscando el GID correcto para Fondo de Ahorro...\n");
  console.log("Buscando marcadores:", FONDO_AHORRO_MARKERS);
  console.log("=".repeat(60));
  
  for (const gid of GIDS_TO_TEST) {
    const result = await checkGid(gid);
    if (result) {
      console.log(`\n🎯 GID ENCONTRADO: ${result}`);
    }
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("\nSi no se encontró el GID, necesitamos obtener todos los GIDs del spreadsheet.");
}

main();
