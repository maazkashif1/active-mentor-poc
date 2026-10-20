const express = require('express');
const User = require('../models/userModel');
const Session = require('../models/sessionModel');
const Prescription = require('../models/prescriptionModel');
const ExerciseResult = require('../models/exerciseResultModel');
const verifyToken = require('../middleware/auth');
const { isSlotOpenAndFuture } = require('../services/scheduleService');
const { IN_PROGRESS_STATUSES } = require('../services/transcriptService');

const router = express.Router();

function openFutureSlots(availability = []) {
  return (availability || [])
    .filter(s => isSlotOpenAndFuture(s))
    .sort((a, b) => (a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date)));
}

// List all physiologists (patient use)
router.get('/all', verifyToken, async (req, res) => {
  try {
    const physios = await User.find({ role: 'physiologist' })
      .select('name email specialty photo bio yearsExperience education clinics availability');
    // Trim availability to open future slots so list filters (e.g. Available Today) work
    res.json(physios.map(p => {
      const obj = p.toObject();
      obj.availability = openFutureSlots(obj.availability);
      return obj;
    }));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get available slots for a physiologist (patient use)
router.get('/slots/:id', verifyToken, async (req, res) => {
  try {
    const physio = await User.findById(req.params.id).select('availability');
    if (!physio) return res.status(404).json({ message: 'Physiologist not found' });
    res.json(openFutureSlots(physio.availability));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add slots (physiologist only)
router.post('/slots', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const { slots } = req.body; // [{ date, time }]
    const user = await User.findById(req.user.id);
    user.availability.push(...slots.map(s => ({ date: s.date, time: s.time })));
    await user.save();
    res.json(user.availability);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete a slot (physiologist only)
router.delete('/slots/:slotId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { availability: { _id: req.params.slotId } },
    });
    res.json({ message: 'Slot removed' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Physiologist's pending sessions
router.get('/sessions/pending', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const sessions = await Session.find({ physiologistId: req.user.id, status: { $in: ['pending', 'active', 'summarised'] } })
      .populate('patientId', 'name email')
      .sort({ createdAt: -1 });
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get own slots (physiologist)
router.get('/my-slots', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('availability');
    res.json({ slots: user?.availability || [] });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get own profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update own profile
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { name, specialty, specialization, yearsExperience, bio, education, photo, clinics } = req.body;
    const update = {};
    if (name != null) update.name = name;
    if (specialty != null || specialization != null) update.specialty = specialty || specialization || '';
    if (yearsExperience !== undefined) update.yearsExperience = yearsExperience;
    if (bio != null) update.bio = bio;
    if (education != null) update.education = education;
    if (photo != null) update.photo = photo;
    if (clinics != null) update.clinics = clinics;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get schedule config
router.get('/schedule', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('schedule');
    res.json({ schedule: user?.schedule || null });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save schedule config
router.patch('/schedule', verifyToken, async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { schedule: req.body },
      { new: true }
    ).select('schedule');
    res.json({ schedule: user.schedule });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Delete all non-booked slots (physiologist)
router.delete('/slots', verifyToken, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, {
      $pull: { availability: { isBooked: false } },
    });
    res.json({ message: 'Available slots cleared' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Bulk add slots
router.post('/slots/bulk', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const { slots } = req.body; // [{ date, time }]
    const user = await User.findById(req.user.id);
    user.availability.push(...slots.map(s => ({ date: s.date, time: s.time })));
    await user.save();
    res.json({ count: slots.length, slots: user.availability });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Set follow-up recommendation date
router.patch('/sessions/:id/followup', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const { followUpDate } = req.body;
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, physiologistId: req.user.id },
      { followUpDate: followUpDate ? new Date(followUpDate) : null },
      { new: true },
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Recent exercise activity for this physio's patients (dashboard feed)
router.get('/activity', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const prescriptions = await Prescription.find({ physiologistId: req.user.id }).select('_id exerciseId targetReps');
    const results = await ExerciseResult.find({ prescriptionId: { $in: prescriptions.map(p => p._id) } })
      .populate('patientId', 'name')
      .populate('prescriptionId', 'exerciseId targetReps')
      .sort({ createdAt: -1 })
      .limit(20);
    res.json(results);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Session history for a specific patient with this physio
router.get('/patient-sessions/:patientId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const sessions = await Session.find({
      physiologistId: req.user.id,
      patientId: req.params.patientId,
    }).sort({ createdAt: -1 }).limit(10);
    res.json(sessions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Approve session and set summary (physiologist only)
router.patch('/sessions/:id/approve', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const { approvedSummary } = req.body;
    const existing = await Session.findOne({ _id: req.params.id, physiologistId: req.user.id }).select('status recallStatus');
    if (!existing) return res.status(404).json({ message: 'Session not found' });
    if (existing.status === 'active' && IN_PROGRESS_STATUSES.includes(existing.recallStatus)) {
      return res.status(409).json({ message: 'The consultation is still being recorded or processed. End the session and wait for the summary before approving.' });
    }
    const session = await Session.findOneAndUpdate(
      { _id: req.params.id, physiologistId: req.user.id },
      { status: 'approved', approvedSummary },
      { new: true },
    );
    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
