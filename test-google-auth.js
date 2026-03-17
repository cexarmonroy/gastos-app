const { google } = require('googleapis');
require('dotenv').config({ path: '.env' });

async function test() {
  const auth = new google.auth.JWT(
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    null,
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    ['https://www.googleapis.com/auth/spreadsheets']
  );

  const sheets = google.sheets({ version: 'v4', auth });
  const spreadsheetId = '1YnLByK8mr5e-qtKsQxPKuirhxm-1J1QK4F4fxG2Yi3Q';

  try {
    const res = await sheets.spreadsheets.get({ spreadsheetId });
    console.log('Success! Spreadsheet title:', res.data.properties.title);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

test();
