/**
 * Optional email via Resend. Lazy-init so missing RESEND_API_KEY
 * does not crash the server at boot (OTP currently returns devCode).
 */
let resend = null;

function getResend() {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  const { Resend } = require('resend');
  resend = new Resend(key);
  return resend;
}

async function sendOtpEmail(to, code) {
  const client = getResend();
  if (!client) {
    console.warn('[Resend] RESEND_API_KEY not set — skipping email to', to);
    return { skipped: true };
  }

  const { data, error } = await client.emails.send({
    from: 'Active Mentor <onboarding@resend.dev>',
    to,
    subject: 'Your Active Mentor verification code',
    html: `
      <div style="font-family:sans-serif;max-width:400px;margin:0 auto;padding:32px">
        <h2 style="color:#333;margin-bottom:8px">Active Mentor</h2>
        <p style="color:#666;margin-bottom:24px">Your verification code:</p>
        <div style="background:#f5f5f5;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
          <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#333">${code}</span>
        </div>
        <p style="color:#999;font-size:13px">Expires in 10 minutes. Do not share it.</p>
      </div>
    `,
  });

  if (error) {
    console.error('[Resend] send failed:', error);
    throw new Error(error.message);
  }
  console.log('[Resend] sent:', data?.id);
  return data;
}

module.exports = { sendOtpEmail };
