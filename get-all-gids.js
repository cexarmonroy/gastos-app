const https = require('https');

const SHEET_ID = "1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q";
const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/htmlview`;

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        // Buscar todos los GIDs en el HTML
        const gidMatches = [...data.matchAll(/gid=(\d+)/g)].map(m => m[1]);
        const uniqueGids = [...new Set(gidMatches)];
        
        console.log("GIDs encontrados en el HTML:");
        uniqueGids.forEach(gid => console.log(`  - ${gid}`));
        
        // Intentar encontrar nombres de hojas
        const sheetNameMatches = [...data.matchAll(/\["([^"]+)",\s*\["gid","(\d+)"\]\]/g)];
        console.log("\nHojas encontradas:");
        sheetNameMatches.forEach(match => {
            console.log(`  - "${match[1]}" -> GID: ${match[2]}`);
        });
        
        // Buscar también en otro formato
        const altMatches = [...data.matchAll(/"([^"]+)":\s*\{[^}]*"gid":\s*"(\d+)"/g)];
        if (altMatches.length > 0) {
            console.log("\nHojas (formato alternativo):");
            altMatches.forEach(match => {
                console.log(`  - "${match[1]}" -> GID: ${match[2]}`);
            });
        }
    });
}).on('error', err => console.error('Error:', err));
