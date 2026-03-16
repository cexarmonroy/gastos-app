const Papa = require("papaparse");

const SHEET_ID = "1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q";

// GIDs encontrados
const GIDS = ["968865594", "410879135", "556398863"];

// Marcadores específicos de Fondo de Ahorro según los datos del usuario
const FONDO_AHORRO_MARKERS = [
  "Fondo inicio de año",
  "5.073.033", // Monto inicial
  "pasto sintetico",
  "1.623.410", // Monto del pasto sintético
  "Fondo caja chica",
  "3.000.000", // Saldo final
];

async function checkGid(gid) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      console.log(`\nGID ${gid}: Error ${res.status}`);
      return null;
    }
    
    const text = await res.text();
    const csvLower = text.toLowerCase();
    
    // Contar marcadores encontrados
    const foundMarkers = FONDO_AHORRO_MARKERS.filter(marker => 
      csvLower.includes(marker.toLowerCase())
    );
    
    const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`GID: ${gid}`);
    console.log(`Filas: ${parsed.data.length}`);
    console.log(`Marcadores encontrados: ${foundMarkers.length}/${FONDO_AHORRO_MARKERS.length}`);
    if (foundMarkers.length > 0) {
      console.log(`Marcadores: ${foundMarkers.join(", ")}`);
    }
    
    if (parsed.data.length > 0) {
      const firstRow = parsed.data[0];
      console.log(`Headers:`, Object.keys(firstRow));
      console.log(`Primera fila:`, firstRow);
      
      // Mostrar todas las descripciones para identificar
      const descriptions = parsed.data
        .filter(r => {
          const keys = Object.keys(r);
          const descKey = keys.find(k => k.toLowerCase().includes('descrip'));
          return descKey && r[descKey] && r[descKey].trim();
        })
        .map(r => {
          const keys = Object.keys(r);
          const descKey = keys.find(k => k.toLowerCase().includes('descrip'));
          return r[descKey]?.trim();
        })
        .filter(Boolean)
        .slice(0, 5);
      
      console.log(`Primeras descripciones:`, descriptions);
      
      if (foundMarkers.length >= 3) {
        console.log(`\n✅ ✅ ✅ ESTE ES EL GID CORRECTO PARA FONDO DE AHORRO! ✅ ✅ ✅`);
        return gid;
      }
    }
    
    return null;
  } catch (err) {
    console.log(`\nGID ${gid}: Error - ${err.message}`);
    return null;
  }
}

async function main() {
  console.log("Probando GIDs para encontrar Fondo de Ahorro...");
  console.log("Buscando marcadores:", FONDO_AHORRO_MARKERS);
  
  let correctGid = null;
  for (const gid of GIDS) {
    const result = await checkGid(gid);
    if (result) {
      correctGid = result;
    }
  }
  
  console.log(`\n${"=".repeat(60)}`);
  if (correctGid) {
    console.log(`\n🎯 GID CORRECTO ENCONTRADO: ${correctGid}`);
  } else {
    console.log(`\n⚠️ No se encontró un GID con los marcadores esperados.`);
    console.log(`Revisa los resultados arriba para identificar cuál es Fondo de Ahorro.`);
  }
}

main();
