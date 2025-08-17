// index.js (server)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const ldap = require('ldapjs');
const os = require('os');
require('dotenv').config();

// Optional: keep the hourly cleaner as a safety net
// (Your per-minute scheduler below already handles expiry deletes)
try {
  require('./cleanupBookings');
} catch (e) {
  console.warn('[Init] cleanupBookings not loaded:', e.message);
}

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

// ---------- Config ----------
const LDAP_URL = process.env.LDAP_URL || 'ldap://10.27.16.5';
const LDAP_BASE_DN = process.env.LDAP_BASE_DN || 'DC=swd,DC=local';
const LDAP_DEFAULT_UPN = process.env.LDAP_DEFAULT_UPN || 'swd.bh';
const LDAP_ALT_UPN = process.env.LDAP_ALT_UPN || 'swd.local';
const LDAP_NETBIOS = process.env.LDAP_NETBIOS || 'SWD';

const SMTP_HOST = process.env.SMTP_HOST || '10.27.16.4';
const SMTP_PORT = Number(process.env.SMTP_PORT || 25);
const SMTP_SECURE = false;
const SMTP_FROM_DEFAULT = process.env.SMTP_FROM_DEFAULT || '"Meeting Booking" <booking@swd.bh>';

// Single source of truth for the frontend URL used in emails
const APP_URL =
  process.env.APP_URL ||
  process.env.REACT_APP_APP_URL ||
  'http://localhost:3000';

// ---------- Firebase Admin ----------
const admin = require('firebase-admin');
if (!admin.apps.length) {
  // Reads GOOGLE_APPLICATION_CREDENTIALS from env, or uses default credentials
  admin.initializeApp();
}
const fdb = admin.firestore();

// ---------- Admin list (match frontend) ----------
const ADMIN_NOTIFICATION_CONFIG = [
  { email: 'a.alkubaesy@swd.bh', floors: [7, 10] },
  { email: 'a.khaled@swd.bh',   floors: [7, 10] },
  { email: 'a.qambar@swd.bh',   floors: [7, 10] },
];
function adminsForFloor(floor) {
  return ADMIN_NOTIFICATION_CONFIG
    .filter((a) => a.floors.includes(Number(floor)))
    .map((a) => a.email);
}

// ---------- Nodemailer ----------
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_SECURE,
  tls: { rejectUnauthorized: false },
});
async function sendMail({ to, subject, text, replyTo, from }) {
  const opts = {
    from: from || SMTP_FROM_DEFAULT,
    to,
    subject,
    text,
    ...(replyTo ? { replyTo } : {}),
  };
  await transporter.sendMail(opts);
}

// ---------- Routes ----------

// LDAP Login
app.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) {
    return res.status(400).json({ success: false, message: 'Missing credentials' });
  }

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

// Email send (frontend calls this)
app.post('/send-email', async (req, res) => {
  const { to, subject, message, fromEmail, replyTo } = req.body || {};
  if (!to || !subject || !message) {
    return res.status(400).json({ success: false, error: 'Missing required email fields' });
  }
  try {
    await sendMail({
      to,
      subject,
      text: message,
      from: fromEmail || SMTP_FROM_DEFAULT,
      replyTo,
    });
    console.log(`✅ Email sent to ${to} (subject: ${subject})`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('❌ Email send error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test Firestore route
app.get('/test-firestore', async (req, res) => {
  try {
    const snap = await fdb.collection('bookings_floor10').limit(1).get();
    res.json({ count: snap.size, sample: snap.docs.map((d) => ({ id: d.id, ...d.data() })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---------- Pending bookings scheduler (START reminders + END cleanup) ----------
const PENDING_COLLECTIONS = [
  { name: 'bookings_floor10', floor: 10 },
  { name: 'bookings_floor7', floor: 7 },
];

setInterval(async () => {
  const now = Date.now();
  const fmt = { timeZone: 'Asia/Bahrain', hour12: true }; // 12h AM/PM

  for (const col of PENDING_COLLECTIONS) {
    try {
      const snap = await fdb.collection(col.name).where('status', '==', 'pending').get();
      if (snap.empty) continue;

      for (const docSnap of snap.docs) {
        const data = docSnap.data();

        const startTime = Date.parse(data.start);
        const endTime = Date.parse(data.end);
        if (!startTime || !endTime) continue;

        const msUntilStart = startTime - now;
        const msUntilEnd = endTime - now;

        const floor = data.floor || col.floor;
        const admins = adminsForFloor(floor);
        const userEmail = data.userEmail;
        const userName = data.name || 'User';
        const room = data.room || 'Room';

        const startTxt = new Date(data.start).toLocaleString('en-GB', fmt);
        const endTxt = new Date(data.end).toLocaleString('en-GB', fmt);

        const deptDisplay =
          data.department === 'Other'
            ? data.customDepartment || 'Other'
            : data.department || '';
        const purposeLine = `Purpose: ${data.purpose || '-'}`;
        const attendeesLine = `Attendees: ${data.attendees ?? '-'}`;

        // ===== START-based reminders =====

        // 1 hour BEFORE START (once)
        if (
          msUntilStart <= 60 * 60 * 1000 &&
          msUntilStart > 30 * 60 * 1000 &&
          !data.startReminder60Sent
        ) {
          const subject = `Reminder: Booking starts in 1 hour (${room}, Floor ${floor})`;
          const adminMsg = `A pending booking will start in 1 hour.

Name: ${userName}
Email: ${userEmail || '-'}
Department: ${deptDisplay}
Room: ${room}
Floor: ${floor}
Start: ${startTxt}
End: ${endTxt}
${purposeLine}
${attendeesLine}

Action: Please approve or decline (or contact the user) before it begins.
Link: ${APP_URL}`;

          const userMsg = `Dear ${userName},

Your meeting room request is still pending and will start in 1 hour.

Room: ${room}
Floor: ${floor}
Start: ${startTxt}
End: ${endTxt}

Please contact the admins to get it approved before it starts.

Best regards,
SWD Booking Team`;

          for (const a of admins)
            await sendMail({ to: a, subject, text: adminMsg, replyTo: userEmail });
          if (userEmail) await sendMail({ to: userEmail, subject, text: userMsg });

          await docSnap.ref.update({ startReminder60Sent: true });
        }

        // 30 minutes BEFORE START (once)
        if (msUntilStart <= 30 * 60 * 1000 && msUntilStart > 0 && !data.startReminder30Sent) {
          const subject = `Reminder: Booking starts in 30 minutes (${room}, Floor ${floor})`;
          const adminMsg = `A pending booking will start in 30 minutes.

Name: ${userName}
Email: ${userEmail || '-'}
Department: ${deptDisplay}
Room: ${room}
Floor: ${floor}
Start: ${startTxt}
End: ${endTxt}
${purposeLine}
${attendeesLine}

Action: Please approve or decline (or contact the user)
Link: ${APP_URL}`;

          const userMsg = `Dear ${userName},

Your meeting room request is still pending and will start in 30 minutes.

Room: ${room}
Floor: ${floor}
Start: ${startTxt}
End: ${endTxt}

Please contact the admins immediately to get it approved before it starts.

Best regards,
SWD Booking Team`;

          for (const a of admins)
            await sendMail({ to: a, subject, text: adminMsg, replyTo: userEmail });
          if (userEmail) await sendMail({ to: userEmail, subject, text: userMsg });

          await docSnap.ref.update({ startReminder30Sent: true });
        }

        // ===== END-based cleanup: auto-delete if still pending after END =====
        if (msUntilEnd <= 0 && data.status === 'pending') {
          const subject = `Auto-removed: Pending booking expired (${room}, Floor ${floor})`;
          const adminMsg = `A pending booking reached its end time and was automatically removed.

Name: ${userName}
Email: ${userEmail || '-'}
Department: ${deptDisplay}
Room: ${room}
Floor: ${floor}
Start: ${startTxt}
End: ${endTxt}
${purposeLine}
${attendeesLine}`;

          const userMsg = `Dear ${userName},

Your meeting room request for ${room} (Floor ${floor}) has expired and was automatically removed because it was still pending at the end time.

If you still need the room, please submit a new request and notify the admins.

Best regards,
SWD Booking Team`;

          for (const a of admins)
            await sendMail({ to: a, subject, text: adminMsg, replyTo: userEmail });
          if (userEmail) await sendMail({ to: userEmail, subject, text: userMsg });

          await docSnap.ref.delete();
        }
      }
    } catch (err) {
      console.error(`Error checking ${col.name}:`, err);
    }
  }
}, 60_000);

// ---------- Start ----------
app.listen(PORT, '0.0.0.0', () => {
  const host = getLocalIPv4('10.');
  console.log(`Server running at http://${host}:${PORT}`);
});
