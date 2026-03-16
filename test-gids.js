const Papa = require("papaparse");

async function checkGid(gid) {
  const url = `https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/export?format=csv&gid=${gid}`;
  const res = await fetch(url);
  const text = await res.text();
  const parsed = Papa.parse(text, { header: true, skipEmptyLines: "greedy" });
  console.log(`\n--- GID: ${gid} ---`);
  console.log(`Filas: ${parsed.data.length}`);
  if (parsed.data.length > 0) {
      console.log(parsed.data.slice(0, 2));
  }
}

async function main() {
  await checkGid("0");
  await checkGid("968865594");
  await checkGid("42426863");
}

main();
