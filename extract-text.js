async function scrapeSheets() {
  const url = "https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/htmlview";
  try {
    const res = await fetch(url);
    const html = await res.text();
    
    console.log("Caja Chica Exists:", html.includes("Caja Chica"));
    console.log("Fondo de Ahorro Exists:", html.includes("Fondo de Ahorro"));
    
    // extraemos un poco más de informacion de las etiquetas de los menu de hojas
    const regex = /\{[^{}]*name:[^{}]*gid:[^{}]*\}/gi;
    const matches = html.match(/\["([^"]*)", ?\["gid","(\d+)"\]\]/g) || html.match(/name.*?gid.*?}/gi) || [];
    
    console.log("Found metadata:");
    matches.slice(0, 5).forEach(m => console.log(m));
    
  } catch (err) {
    console.error(err);
  }
}

scrapeSheets();
