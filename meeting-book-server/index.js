const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const googleSheetsRoutes = require('./googleSheets');
const nodemailer = require('nodemailer');
const path = require('path');
const ldap = require('ldapjs');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ✅ Prefer logging a 10.x address if present (falls back to first external or localhost)
function getLocalIPv4(preferPrefix = '10.') {
  const nets = os.networkInterfaces();
  let fallback = null;
  for (const ifaces of Object.values(nets)) {
    for (const n of ifaces) {
      if (n && n.family === 'IPv4' && !n.internal) {
        if (!fallback) fallback = n.address;
        if (n.address.startsWith(preferPrefix)) return n.address;
      }
    }
  }
  return fallback || 'localhost';
}

// ✅ Google Sheets routes (ensure any wildcards inside use "/*" or "(.*)" for Express 5)
app.use('/', googleSheetsRoutes);

// ✅ LDAP Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, message: "Missing credentials" });
  }

  const client = ldap.createClient({
    url: 'ldap://10.27.16.5' // SWDADC
  });

  const userPrincipalName = username.includes("@") ? username : `${username}@swd.bh`;

  client.bind(userPrincipalName, password, (err) => {
    if (err) {
      console.error('LDAP bind failed:', err.message);
      return res.status(401).json({ success: false, message: "Invalid username or password" });
    }

    const searchOptions = {
      scope: 'sub',
      filter: `(userPrincipalName=${userPrincipalName})`,
      attributes: ['cn', 'mail', 'department']
    };

    const baseDN = 'DC=swd,DC=local';

    client.search(baseDN, searchOptions, (err, searchRes) => {
      if (err) {
        console.error('LDAP search error:', err.message);
        return res.status(500).json({ success: false, message: 'LDAP search failed' });
      }

      let userData = {};

      searchRes.on('searchEntry', (entry) => {
        const user = entry.object;
        userData = {
          name: user.cn || username,
          email: user.mail || userPrincipalName,
          department: user.department || ''
        };
      });

      searchRes.on('end', () => {
        return res.status(200).json({
          success: true,
          user: userData
        });
      });

      searchRes.on('error', (err) => {
        console.error('LDAP search error:', err.message);
        return res.status(500).json({ success: false, message: 'LDAP search failed' });
      });
    });
  });

  client.on('error', (err) => {
    console.error('LDAP connection error:', err.message);
  });
});

// ✅ Internal Email via SMTP Relay (supports custom sender)
app.post('/send-email', async (req, res) => {
  const { to, subject, message, fromEmail } = req.body;

  if (!to || !subject || !message) {
    return res.status(400).json({ success: false, error: "Missing required email fields" });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: "10.27.16.4", // Internal SMTP
      port: 25,
      secure: false,
      tls: {
        rejectUnauthorized: false,
      },
    });

    const mailOptions = {
      from: fromEmail || `"Meeting Booking" <booking@swd.bh>`,
      to,
      subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent from ${mailOptions.from} to ${to}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error("❌ Email send error:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ Serve React build in production (Express 5-compatible catch-all)
if (process.env.NODE_ENV === "production") {
  const clientBuildPath = path.join(__dirname, "../meeting-book-client/build");
  app.use(express.static(clientBuildPath));

  app.get("/*", (req, res) => {
    res.sendFile(path.join(clientBuildPath, "index.html"));
  });
}

// ✅ Start server (bind all interfaces) with auto-detected IP in log
app.listen(PORT, '0.0.0.0', () => {
  const host = getLocalIPv4('10.');
  console.log(`Server running at http://${host}:${PORT}`);
});
