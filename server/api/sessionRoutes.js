const express = require('express');
const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const verifyToken = require('../middleware/auth');
const calendarService = require('../services/calendarService');
const { ensureBot } = require('../services/botOrchestrator');
const { processTranscript } = require('../services/transcriptService');
// Sadaan Attempt
const { APP_TIMEZONE, slotToDate } = require('../services/timeService');

const router = express.Router();

// [OLD — wrong] Interprets the slot in the server's timezone (UTC on Render),
// so every meeting/status transition was off by the physio's UTC offset.
// function scheduledAt(s) {
//   const [y, m, d] = s.slotDate.split('-').map(Number);
//   const [h, min]  = s.slotTime.split(':').map(Number);
//   return new Date(y, m - 1, d, h, min);
// }

// Sadaan Attempt
function scheduledAt(s) {
  return s.scheduledStart || slotToDate(s.slotDate, s.slotTime);
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
      // Sadaan Attempt
      scheduledStart: slotToDate(slotDate, slotTime),
    });

    await Promise.all([session.save(), physio.save()]);

    // Create Google Meet via Calendar if physio has connected Google
    if (!physio.googleTokens?.refreshToken) {
      // Sadaan Attempt — surface why there will be no meeting/bot instead of failing silently
      session.recallStatus = 'no_meeting_link';
      session.recallError = "The physiotherapist's Google Calendar is not connected, so no Meet link or scribe bot was created.";
      await session.save();
    } else {
      try {
        const tokens = {
          access_token: physio.googleTokens.accessToken,
          refresh_token: physio.googleTokens.refreshToken,
          expiry_date: physio.googleTokens.expiryDate,
        };
        // [OLD — wrong] server-local timezone (UTC on Render)
        // const [year, month, day] = slotDate.split('-').map(Number);
        // const [hour, minute] = slotTime.split(':').map(Number);
        // const start = new Date(year, month - 1, day, hour, minute);
        // Sadaan Attempt
        const start = session.scheduledStart;
        const end   = new Date(start.getTime() + 60 * 60 * 1000);
        const { meetingUrl, eventId, newTokens } = await calendarService.createMeeting({
          tokens,
          summary: `Active Mentor Consultation — ${physio.name}`,
          startISO: start.toISOString(),
          endISO:   end.toISOString(),
          attendeeEmails: [physio.email].filter(Boolean),
          // Sadaan Attempt
          timeZone: APP_TIMEZONE,
        });
        session.meetingUrl = meetingUrl;
        // Sadaan Attempt — eventId was returned but never saved
        session.eventId = eventId || '';
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
        // Sadaan Attempt
        session.recallStatus = 'no_meeting_link';
        session.recallError = `Google Meet creation failed (physio may need to reconnect Google): ${e.message}`;
        await session.save().catch(() => {});
      }
    }

    // [OLD — wrong] Bot was sent immediately at booking time (no join_at), so it
    // timed out in an empty lobby long before the consultation started.
    // if (session.meetingUrl) {
    //   recallService.createBot(session.meetingUrl, session._id)
    //     .then(botId => Session.findByIdAndUpdate(session._id, { recallBotId: botId }))
    //     .catch(e => console.error('Recall bot creation failed:', e.message));
    // }

    // Sadaan Attempt
    // Schedule the Recall bot to join at the session start time (non-blocking).
    // The "Start session" endpoint and the scheduler top this up if it fails.
    if (session.meetingUrl) {
      ensureBot(session._id).catch(e => console.error('Recall bot scheduling failed:', e.message));
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

// Sadaan Attempt
// "Meeting started" trigger. Called when the physio (portal) or patient (app) presses
// Start/Join. Makes sure the scribe bot is in — or on its way into — the Meet now.
const START_EARLY_MS = 30 * 60 * 1000;
const START_LATE_MS = 3 * 60 * 60 * 1000;

router.post('/:id/start', verifyToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);
    if (!session) return res.status(404).json({ message: 'Session not found' });

    const uid = String(req.user.id);
    if (uid !== String(session.physiologistId) && uid !== String(session.patientId)) {
      return res.status(403).json({ message: 'Not your session' });
    }
    if (!session.meetingUrl) {
      return res.status(400).json({ message: 'This session has no Meet link', recallStatus: session.recallStatus });
    }

    const offset = Date.now() - scheduledAt(session).getTime();
    if (offset < -START_EARLY_MS || offset > START_LATE_MS) {
      return res.json({ started: false, reason: 'outside_session_window', meetingUrl: session.meetingUrl, recallStatus: session.recallStatus });
    }

    if (session.status === 'pending') session.status = 'active';
    if (!session.startedAt) session.startedAt = new Date();
    await session.save();

    // An explicit start gives a fresh attempt budget if earlier bots gave up.
    const retryable = ['failed', 'needs_retry', 'create_failed'].includes(session.recallStatus);
    if (session.recallStatus === 'failed') {
      await Session.updateOne({ _id: session._id }, { recallStatus: 'needs_retry' });
    }
    const { state } = await ensureBot(session._id, { now: true, resetAttempts: retryable });
    // Bot already finished a recording but the webhook was missed → pick up the transcript.
    if (state === 'recorded') processTranscript(session._id, session.recallBotId).catch(() => {});

    const fresh = await Session.findById(session._id);
    res.json({ started: true, bot: state, meetingUrl: fresh.meetingUrl, recallStatus: fresh.recallStatus, recallError: fresh.recallError });
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
