const { google } = require('googleapis');
require('dotenv').config({ path: '.env' });

async function debugGids() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q';

  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    const fs = require('fs');
    let output = '';
    res.data.sheets.forEach(s => {
      output += `${s.properties.title} | ID: ${s.properties.sheetId}\n`;
    });
    fs.writeFileSync('gids_output.txt', output);
    console.log('Output written to gids_output.txt');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

debugGids();
