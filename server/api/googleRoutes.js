const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const calendarService = require('../services/calendarService');

const router = express.Router();

// Browser navigates here — can't send Authorization header, so JWT is in query param
router.get('/google', (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');
  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(401).send('Invalid token');
  }
  res.redirect(calendarService.getAuthUrl(token));
});

router.get('/google/callback', async (req, res) => {
  const { code, state } = req.query;
  try {
    const { id } = jwt.verify(state, process.env.JWT_SECRET);
    const tokens = await calendarService.exchangeCode(code);
    await User.findByIdAndUpdate(id, {
      googleTokens: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: tokens.expiry_date,
      },
    });
    res.send('<html><body><h2>Google Calendar connected. You can close this tab.</h2></body></html>');
  } catch (err) {
    res.status(500).send('OAuth error: ' + err.message);
  }
});

module.exports = router;
