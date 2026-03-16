async function check(gid) {
  const url = gid ? `https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/export?format=csv&gid=${gid}` : `https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/export?format=csv`;
  const res = await fetch(url);
  const text = await res.text();
  console.log(`GID: ${gid || "default"} | Status: ${res.status} | Length: ${text.length}`);
  if (res.ok) {
      console.log(text.substring(0, 100));
  }
}

async function main() {
  await check(null);
  await check("968865594");
  await check("42426863");
}
main();
