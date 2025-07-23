const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  host: "10.27.16.4",
  port: 25,              // Many internal relays use port 25
  secure: false,         // No TLS
  tls: {
    rejectUnauthorized: false, // Ignore self-signed certs
  },
});


(async () => {
  try {
    await transporter.verify();
    console.log('✅ SMTP Login Successful');
  } catch (err) {
    console.error('❌ SMTP Login Failed:', err.message);
  }
})();
