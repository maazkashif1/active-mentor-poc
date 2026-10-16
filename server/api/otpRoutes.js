const express = require('express');
const mongoose = require('mongoose');
// OTP emails optional — currently return devCode; wire sendOtpEmail when Resend domain is ready
// const { sendOtpEmail } = require('../services/emailService');

const router = express.Router();

// ponytail: inline model to avoid a separate file; upgrade to its own file if OTP grows (e.g. rate limiting)
const otpSchema = new mongoose.Schema({
  email: { type: String, required: true, lowercase: true, index: true },
  code: String,
  expiresAt: { type: Date, index: { expireAfterSeconds: 0 } },
});
const OtpRecord = mongoose.models.OtpRecord || mongoose.model('OtpRecord', otpSchema);

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

router.post('/send-otp', async (req, res) => {
  const { email } = req.body;
  if (!email || !email.includes('@')) {
    return res.status(400).json({ message: 'Valid email required' });
  }
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

  try {
    // upsert so re-sends overwrite the old code
    await OtpRecord.findOneAndUpdate(
      { email: email.toLowerCase() },
      { code, expiresAt },
      { upsert: true, new: true },
    );
    console.log('[OTP] code generated for', email, '→', code);
    // ponytail: skipping email send until domain verified on Resend; code returned directly
    res.json({ message: 'OTP sent', devCode: code });
  } catch (err) {
    console.error('[OTP] send-otp failed for', email, err);
    res.status(500).json({ message: 'Failed to send OTP', detail: err.message });
  }
});

router.post('/verify-otp', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ message: 'Email and code required' });

  try {
    const entry = await OtpRecord.findOne({ email: email.toLowerCase() });
    if (!entry) {
      console.log('[OTP] no record for', email);
      return res.status(400).json({ message: 'No OTP found for this email' });
    }
    if (new Date() > entry.expiresAt) {
      await OtpRecord.deleteOne({ email: email.toLowerCase() });
      console.log('[OTP] expired for', email);
      return res.status(400).json({ message: 'OTP expired' });
    }
    if (entry.code !== String(code)) {
      console.log('[OTP] wrong code for', email);
      return res.status(400).json({ message: 'Incorrect code' });
    }
    await OtpRecord.deleteOne({ email: email.toLowerCase() });
    console.log('[OTP] verified for', email);
    res.json({ message: 'Verified' });
  } catch (err) {
    console.error('[OTP] verify-otp failed for', email, err);
    res.status(500).json({ message: 'Verification error', detail: err.message });
  }
});

module.exports = router;
