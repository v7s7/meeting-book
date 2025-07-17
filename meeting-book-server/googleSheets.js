// meeting-book-server/googleSheets.js
const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const path = require('path');

const auth = new google.auth.GoogleAuth({
  keyFile: path.join(__dirname, 'booking-service-account.json'),
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
});

const spreadsheetId = '1GMoEZNVze9VQR854Me4KCRY9QhHYo2O9E156OyriqM0';

router.post('/add-booking', async (req, res) => {
      console.log('📥 Received booking request:', req.body); // <—

  try {
    const client = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: client });

    const { name, cpr, phone, department, room, start, end, userId } = req.body;

    const date = new Date(start).toLocaleDateString('en-GB');
    const startTime = new Date(start).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const endTime = new Date(end).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const row = [[name, cpr, phone, department, room, date, startTime, endTime, userId]];
    console.log('📤 Sending row:', row);

    await sheets.spreadsheets.values.append({
      spreadsheetId,
        range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      resource: { values: row },
    });

    res.status(200).send('✅ Booking saved to Google Sheet');
  } catch (err) {
    console.error('❌ Failed to save booking:', err.message);
    res.status(500).send('Error saving booking');
  }
});

module.exports = router;
