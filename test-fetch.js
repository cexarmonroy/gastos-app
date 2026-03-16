const Papa = require("papaparse");

async function main() {
  const url = "https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/export?format=csv";
  try {
    console.log("Fetching: " + url);
    const res = await fetch(url);
    if (!res.ok) {
      console.log("Failed to fetch with status: " + res.status);
      return;
    }
    const text = await res.text();
    console.log("CSV CONTENT:");
    console.log(text.substring(0, 500));
    const parsed = Papa.parse(text, { header: true });
    console.log("PARSED RECORDS:");
    console.log(parsed.data.slice(0, 3));
  } catch (err) {
    console.error(err);
  }
}

main();
