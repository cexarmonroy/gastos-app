const https = require('https');

const url = "https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/htmlview";

https.get(url, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
        const matches = [...data.matchAll(/gid=(\d+)/g)].map(m => m[1]);
        const unique = [...new Set(matches)];
        console.log("Found GIDs:", unique);
        
        // Let's also try to find sheet names
        const nameMatches = [...data.matchAll(/"([^"]+)"\s*:\s*\["gid"/g)];
        console.log("Possible Names:", nameMatches.map(m => m[1]));
    });
}).on('error', err => console.error(err));
