const cheerio = require('cheerio');

async function scrapeSheets() {
  const url = "https://docs.google.com/spreadsheets/d/1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q/htmlview";
  try {
    const res = await fetch(url);
    const html = await res.text();
    const $ = cheerio.load(html);
    
    $('li[id^="sheet-button-"]').each((i, el) => {
        const id = $(el).attr('id');
        const name = $(el).text().trim();
        console.log(`Sheet Name: "${name}" | ID: ${id}`);
    });

  } catch (err) {
    console.error(err);
  }
}

scrapeSheets();
