const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const googleSheetsRoutes = require('./googleSheets'); // ✅

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Mount your route
app.use('/', googleSheetsRoutes); // This connects /add-booking

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
