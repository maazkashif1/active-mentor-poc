const express = require('express');
const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

// In-memory store: email → { code, expiresAt }
const otpStore = new Map();

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email required' });
  }
  const code = generateCode();
  otpStore.set(email.toLowerCase(), { code, expiresAt: Date.now() + 10 * 60 * 1000 });

  try {
    await sendOtpEmail(email, code);
    res.json({ message: 'OTP sent' });
  } catch (err) {
    console.error('Email send failed:', err.message);
    res.status(500).json({ message: 'Failed to send email. Check SMTP config.' });
  }
});

router.post('/verify-otp', (req, res) => {
  const { email, code } = req.body;
  const entry = otpStore.get(email?.toLowerCase());
  if (!entry) return res.status(400).json({ message: 'No OTP found for this email' });
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(email.toLowerCase());
    return res.status(400).json({ message: 'OTP expired' });
  }
  if (entry.code !== String(code)) {
    return res.status(400).json({ message: 'Incorrect code' });
  }
  otpStore.delete(email.toLowerCase());
  res.json({ message: 'Verified' });
});

module.exports = router;
