const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const ldap = require('ldapjs');
const os = require('os');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(bodyParser.json());

// ---------- Helpers ----------
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

// ---------- Config (env with safe defaults) ----------
const LDAP_URL = process.env.LDAP_URL || 'ldap://10.27.16.5';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'DC=swd,DC=local';
const LDAP_DEFAULT_UPN = process.env.LDAP_DEFAULT_UPN || 'swd.bh';     // email-style suffix
const LDAP_ALT_UPN = process.env.LDAP_ALT_UPN || 'swd.local';          // AD DNS suffix
const LDAP_NETBIOS = process.env.LDAP_NETBIOS || 'SWD';                // NetBIOS/short domain

const SMTP_HOST = process.env.SMTP_HOST || '10.27.16.4';
const SMTP_PORT = Number(process.env.SMTP_PORT || 25);
const SMTP_SECURE = false; // port 25, internal relay
const SMTP_FROM_DEFAULT = process.env.SMTP_FROM_DEFAULT || '"Meeting Booking" <booking@swd.bh>';

// ---------- Routes ----------

// LDAP Login (tries multiple credential formats)
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }

  // Candidate bind names to try
  const candidates = [];
  if (username.includes('@') || username.includes('\\')) {
    candidates.push(username);
  } else {
    candidates.push(
      `${username}@${LDAP_DEFAULT_UPN}`,
      `${username}@${LDAP_ALT_UPN}`,
      `${LDAP_NETBIOS}\\${username}`
    );
  }
  if (!candidates.includes(username)) candidates.push(username);

  const tryBind = (bindName) =>
    new Promise((resolve, reject) => {
      const client = ldap.createClient({
        url: LDAP_URL,
        timeout: 8000,
        connectTimeout: 8000,
        reconnect: false,
      });
      client.bind(bindName, password, (err) => {
        if (err) {
          client.unbind(() => {});
          return reject(err);
        }
        return resolve(client);
      });
    });

  const doSearch = (client, upnUsed) =>
    new Promise((resolve, reject) => {
      const filter = `(|(userPrincipalName=${upnUsed})(sAMAccountName=${username}))`;
      const opts = { scope: 'sub', filter, attributes: ['cn', 'mail', 'department'] };

      client.search(LDAP_BASE_DN, opts, (err, searchRes) => {
        if (err) return reject(err);
        let userData = null;

        searchRes.on('searchEntry', (entry) => {
          const u = entry.object || {};
          userData = {
            name: u.cn || username,
            email: u.mail || upnUsed,
            department: u.department || '',
          };
        });
        searchRes.on('error', (e) => reject(e));
        searchRes.on('end', () => {
          client.unbind(() => {});
          if (!userData) return reject(new Error('User not found in LDAP search'));
          resolve(userData);
        });
      });
    });

  for (const candidate of candidates) {
    try {
      const client = await tryBind(candidate);
      const user = await doSearch(client, candidate);
      return res.status(200).json({ success: true, user });
    } catch (e) {
      console.warn(`[LDAP] bind/search failed for "${candidate}": ${e.message}`);
    }
  }

  return res.status(401).json({ success: false, message: 'Invalid username or password' });
});

// Internal Email via SMTP Relay (supports custom sender)
app.post('/send-email', async (req, res) => {
  const { to, subject, message, fromEmail } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ success: false, error: 'Missing required email fields' });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      tls: { rejectUnauthorized: false },
    });

    const mailOptions = {
      from: fromEmail || SMTP_FROM_DEFAULT,
      to,
      subject,
      text: message,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent from ${mailOptions.from} to ${to}`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve React build in production (Express 5-safe)
if (process.env.NODE_ENV === 'production') {
  const clientBuildPath = path.join(__dirname, '../meeting-book-client/build');
  app.use(express.static(clientBuildPath));
  app.get('/*', (req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
}

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  const host = getLocalIPv4('10.');
  console.log(`Server running at http://${host}:${PORT}`);
});
