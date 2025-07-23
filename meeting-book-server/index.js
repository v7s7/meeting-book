const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const googleSheetsRoutes = require('./googleSheets');
const nodemailer = require('nodemailer');
const path = require('path');
const fetch = require('node-fetch'); // For Microsoft Graph API
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Google Sheets routes
app.use('/', googleSheetsRoutes);

// ✅ Email route (NodeMailer for pending, Graph API for admin approve/decline)
app.post('/send-email', async (req, res) => {
  const { to, subject, message, accessToken } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ success: false, error: "Missing required email fields" });
  }

  try {
    // If accessToken is provided, use Microsoft Graph API (for admin actions)
    if (accessToken) {
      const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            subject: subject,
            body: {
              contentType: "Text",
              content: message,
            },
            toRecipients: [
              { emailAddress: { address: to } },
            ],
          },
          saveToSentItems: "true",
        }),
      });

      if (!graphResponse.ok) {
        const errorDetails = await graphResponse.text();
        console.error("❌ Graph API sendMail error:", errorDetails);
        return res.status(500).json({ success: false, error: errorDetails });
      }

      console.log(`✅ Graph email sent to ${to}`);
      return res.status(200).json({ success: true });
    }

    // Otherwise, send via internal SMTP relay (NodeMailer)
    const transporter = nodemailer.createTransport({
      host: "10.27.16.4", // Internal SMTP relay
      port: 25,           // Port 25 (no authentication usually needed)
      secure: false,      // No TLS
      tls: {
        rejectUnauthorized: false, // Allow self-signed certificates
      },
    });

    const mailOptions = {
      from: `"Meeting Booking" <noreply@swd.bh>`, // Use a valid email address for 'from'
      to,
      subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Internal SMTP email sent to ${to}`);
    res.status(200).json({ success: true });

  } catch (error) {
    console.error("❌ Email send error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Serve React build in production
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../meeting-book-client/build");
  app.use(express.static(clientBuildPath));

  // Handle React routing
  app.get("*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
