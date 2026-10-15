const express = require('express');
const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const verifyToken = require('../middleware/auth');
const calendarService = require('../services/calendarService');
const recallService = require('../services/recallService');

const router = express.Router();

function scheduledAt(s) {
  const [y, m, d] = s.slotDate.split('-').map(Number);
  const [h, min]  = s.slotTime.split(':').map(Number);
  return new Date(y, m - 1, d, h, min);
}

const MISSED_WINDOW_MS = 90 * 60 * 1000;

async function maybeActivate(sessions) {
  const now = new Date();
  const toActivate = [];
  const toMiss = [];

  for (const s of sessions) {
    if (s.status === 'pending' || s.status === 'active') {
      const start = scheduledAt(s);
      const elapsed = now - start;
      if (elapsed >= MISSED_WINDOW_MS && !s.transcriptText && s.status !== 'summarised') {
        toMiss.push(s);
      } else if (s.status === 'pending' && elapsed >= 0) {
        toActivate.push(s);
      }
    }
  }

  if (toMiss.length) {
    await Session.updateMany({ _id: { $in: toMiss.map(s => s._id) } }, { status: 'missed' });
    toMiss.forEach(s => { s.status = 'missed'; });
  }
  if (toActivate.length) {
    await Session.updateMany({ _id: { $in: toActivate.map(s => s._id) } }, { status: 'active' });
    toActivate.forEach(s => { s.status = 'active'; });
  }
}

router.post('/book', verifyToken, async (req, res) => {
  try {
    const { physiologistId, slotDate, slotTime, complaints } = req.body;

    const physio = await User.findById(physiologistId);
    if (!physio) return res.status(404).json({ message: 'Physiologist not found' });

    // Mark slot as booked
    const slot = physio.availability.find(s => s.date === slotDate && s.time === slotTime && !s.isBooked);
    if (!slot) return res.status(400).json({ message: 'Slot not available' });
    slot.isBooked = true;

    const session = new Session({
      patientId: req.user.id,
      physiologistId,
      slotDate,
      slotTime,
      complaints,
    });

    await Promise.all([session.save(), physio.save()]);

    // Create Google Meet via Calendar if physio has connected Google
    if (physio.googleTokens?.refreshToken) {
      try {
        const tokens = {
          access_token: physio.googleTokens.accessToken,
          refresh_token: physio.googleTokens.refreshToken,
          expiry_date: physio.googleTokens.expiryDate,
        };
        const [year, month, day] = slotDate.split('-').map(Number);
        const [hour, minute] = slotTime.split(':').map(Number);
        const start = new Date(year, month - 1, day, hour, minute);
        const end   = new Date(start.getTime() + 60 * 60 * 1000);
        const { meetingUrl, eventId, newTokens } = await calendarService.createMeeting({
          tokens,
          summary: `Active Mentor Consultation — ${physio.name}`,
          startISO: start.toISOString(),
          endISO:   end.toISOString(),
          attendeeEmails: [physio.email].filter(Boolean),
        });
        session.meetingUrl = meetingUrl;
        if (newTokens) {
          await User.findByIdAndUpdate(physiologistId, {
            googleTokens: {
              accessToken:  newTokens.access_token,
              refreshToken: newTokens.refresh_token ?? physio.googleTokens.refreshToken,
              expiryDate:   newTokens.expiry_date,
            },
          });
        }
        await session.save();
      } catch (e) {
        console.error('Google Meet creation failed:', e.message);
      }
    }

    // Spin up Recall bot non-blocking
    if (session.meetingUrl) {
      recallService.createBot(session.meetingUrl, session._id)
        .then(botId => Session.findByIdAndUpdate(session._id, { recallBotId: botId }))
        .catch(e => console.error('Recall bot creation failed:', e.message));
    }

    res.status(201).json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// All sessions for logged-in physiologist (portal uses this)
router.get('/physio', verifyToken, async (req, res) => {
  try {
    const sessions = await Session.find({ physiologistId: req.user.id })
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 });
    await maybeActivate(sessions);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/my', verifyToken, async (req, res) => {
  try {
    const sessions = await Session.find({ patientId: req.user.id })
      .populate('physiologistId', 'name email')
      .sort({ createdAt: -1 });
    await maybeActivate(sessions);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/:id', verifyToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id)
      .populate('patientId', 'name email')
      .populate('physiologistId', 'name email');
    if (!session) return res.status(404).json({ message: 'Session not found' });
    await maybeActivate([session]);
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
