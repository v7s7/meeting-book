const express = require("express");
const fetch = require("node-fetch");

const router = express.Router();

/**
 * POST /send-email
 * Expects: { to, subject, message, accessToken }
 */
router.post("/", async (req, res) => {
  const { to, subject, message, accessToken } = req.body;

  if (!accessToken) {
    return res.status(400).json({ success: false, error: "Missing access token" });
  }

  if (!to || !subject || !message) {
    return res.status(400).json({ success: false, error: "Missing required email fields." });
  }

  try {
    const emailPayload = {
      message: {
        subject,
        body: {
          contentType: "Text",
          content: message,
        },
        toRecipients: [
          {
            emailAddress: {
              address: to,
            },
          },
        ],
      },
      saveToSentItems: "true",
    };

    const graphResponse = await fetch("https://graph.microsoft.com/v1.0/me/sendMail", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(emailPayload),
    });

    if (!graphResponse.ok) {
      const errorDetails = await graphResponse.text();
      console.error("Graph API error:", errorDetails);
      return res.status(graphResponse.status).json({
        success: false,
        error: errorDetails,
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Email send error:", error);
    return res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
