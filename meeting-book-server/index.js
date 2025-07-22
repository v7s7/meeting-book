const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const googleSheetsRoutes = require('./googleSheets');
const fetch = require('node-fetch');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Google Sheets routes
app.use('/', googleSheetsRoutes);

// ✅ Email route using Microsoft Graph API
app.post('/send-email', async (req, res) => {
  const { to, subject, message, accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ success: false, error: "Missing access token" });
  }

  try {
    const emailPayload = {
      message: {
        subject,
        body: {
          contentType: "Text",
          content: message
        },
        toRecipients: [
          { emailAddress: { address: to } }
        ]
      },
      saveToSentItems: "true"
    };

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(emailPayload)
    });

    if (!graphResponse.ok) {
      const errorDetails = await graphResponse.text();
      console.error("Graph API error:", errorDetails);
      return res.status(graphResponse.status).json({ success: false, error: errorDetails });
    }

    res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Serve React build in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../meeting-book-client/build");
  app.use(express.static(clientBuildPath));

  // Handle React routing, return all requests to index.html
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
