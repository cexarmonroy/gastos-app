const { google } = require("googleapis");
require("dotenv").config();

async function listSheets() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = "1HO9s7tRtMleRpBPacaBizaGDOkAEWMaRnFOOLrjsF4o";

  try {
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    const sheetInfo = spreadsheet.data.sheets.map(sheet => ({
      title: sheet.properties.title,
      sheetId: sheet.properties.sheetId
    }));

    console.log(JSON.stringify(sheetInfo, null, 2));

    // Also get headers of the first sheet to understand structure
    if (sheetInfo.length > 0) {
      const firstSheet = sheetInfo[0].title;
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${firstSheet}!A1:Z1`,
      });
      console.log("\nHeaders of first sheet (" + firstSheet + "):");
      console.log(JSON.stringify(response.data.values[0], null, 2));
    }

  } catch (error) {
    console.error("Error listing sheets:", error.message);
  }
}

listSheets();
