const { google } = require('googleapis');
require('dotenv').config({ path: '.env' });

async function checkHeaders() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q';
  const range = "'Fondo de Ahorro'!A1:F5";

  try {
    const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
    const fs = require('fs');
    fs.writeFileSync('headers_output.txt', JSON.stringify(res.data.values, null, 2));
    console.log('Headers written to headers_output.txt');
  } catch (err) {
    console.error('Error:', err.message);
  }
}

checkHeaders();
