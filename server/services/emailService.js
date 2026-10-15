const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   Number(process.env.SMTP_PORT) || 587,
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendOtpEmail(to, code) {
  await transporter.sendMail({
    from: `"Active Mentor" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
    to,
    subject: 'Your Active Mentor verification code',
    text: `Your verification code is: ${code}\n\nThis code expires in 10 minutes.`,
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px">
        <h2 style="color:#333;margin-bottom:8px">Active Mentor</h2>
        <p style="color:#666;margin-bottom:24px">Your verification code:</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#333">${code}</span>
        </div>
        <p style="color:#999;font-size:13px">This code expires in 10 minutes. Do not share it with anyone.</p>
      </div>
    `,
  });
}

module.exports = { sendOtpEmail };
