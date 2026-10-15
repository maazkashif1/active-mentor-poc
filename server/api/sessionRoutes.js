const express = require('express');
const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const verifyToken = require('../middleware/auth');
const calendarService = require('../services/calendarService');
const recallService = require('../services/recallService');

const router = express.Router();

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

    // Try to create Google Meet
    if (physio.googleTokens?.refreshToken) {
      try {
        const patient = await User.findById(req.user.id).select('email');
        const start = new Date(`${slotDate}T${slotTime}`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const { meetingUrl, eventId, newTokens } = await calendarService.createMeeting({
          tokens: physio.googleTokens,
          summary: `Consultation: ${patient.email}`,
          startISO: start.toISOString(),
          endISO: end.toISOString(),
          attendeeEmails: [physio.email, patient.email],
        });
        session.meetingUrl = meetingUrl;
        session.eventId = eventId;
        if (newTokens) {
          physio.googleTokens = { ...physio.googleTokens, ...newTokens };
        }
      } catch (e) {
        console.error('Google Meet creation failed, using fallback:', e.message);
        session.meetingUrl = `https://meet.jit.si/active-mentor-${session._id}`;
      }
    } else {
      session.meetingUrl = `https://meet.jit.si/active-mentor-${session._id}`;
    }

    await Promise.all([session.save(), physio.save()]);

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
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
