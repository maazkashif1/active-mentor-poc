const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const calendarService = require('../services/calendarService');

const router = express.Router();

const PORTAL_URL = () =>
  (process.env.PHYSIO_PORTAL_URL || process.env.PORTAL_URL || 'http://localhost:5173').replace(/\/$/, '');

function safeReturnPath(raw) {
  if (!raw || typeof raw !== 'string') return '/onboarding/calendar';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/onboarding/calendar';
  return raw;
}

// Browser navigates here — can't send Authorization header, so JWT is in query param
router.get('/google', (req, res) => {
  const { token, returnTo } = req.query;
  if (!token) return res.status(400).send('Missing token');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid token');
  }
  // Encode return path into OAuth state alongside the JWT (calendarService uses token as state)
  const statePayload = {
    token,
    returnTo: safeReturnPath(returnTo),
  };
  res.redirect(calendarService.getAuthUrl(Buffer.from(JSON.stringify(statePayload)).toString('base64url')));
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  try {
    let jwtToken = state;
    let returnTo = '/onboarding/calendar';
    // New flow: state is base64url({ token, returnTo })
    try {
      const parsed = JSON.parse(Buffer.from(String(state), 'base64url').toString('utf8'));
      if (parsed?.token) {
        jwtToken = parsed.token;
        returnTo = safeReturnPath(parsed.returnTo);
      }
    } catch {
      // Legacy: state was the raw JWT
    }

    const { id } = jwt.verify(jwtToken, process.env.JWT_SECRET);
    const tokens = await calendarService.exchangeCode(code);
    await User.findByIdAndUpdate(id, {
      googleTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      },
    });

    const dest = `${PORTAL_URL()}${returnTo}${returnTo.includes('?') ? '&' : '?'}google=connected`;
    res.redirect(dest);
  } catch (err) {
    res.status(500).send('OAuth error: ' + err.message);
  }
});

module.exports = router;
