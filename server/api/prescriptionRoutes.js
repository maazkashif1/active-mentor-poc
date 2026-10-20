const express = require('express');
const Prescription = require('../models/prescriptionModel');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// Create prescription (physiologist only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const {
      sessionId, patientId, exerciseId, exerciseName, raiseAngleThreshold, lowerAngleThreshold,
      minAdaptedAngle, targetReps, notes, side,
    } = req.body;
    const prescription = await Prescription.create({
      sessionId,
      patientId,
      physiologistId: req.user.id,
      exerciseId,
      exerciseName: exerciseName || '',
      raiseAngleThreshold,
      lowerAngleThreshold,
      minAdaptedAngle: minAdaptedAngle ?? null,
      targetReps,
      side: ['left', 'right', 'both'].includes(side) ? side : 'both',
      notes,
    });
    res.status(201).json(prescription);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update prescription (physiologist only).
// Clears currentAdaptedAngle when raiseAngleThreshold or minAdaptedAngle changes
// so the next session starts fresh against the new targets.
router.patch('/:id', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const updates = { ...req.body };
    if ('raiseAngleThreshold' in updates || 'minAdaptedAngle' in updates) {
      updates.currentAdaptedAngle = null;
    }
    // A physio can only edit their own prescriptions.
    const prescription = await Prescription.findOneAndUpdate(
      { _id: req.params.id, physiologistId: req.user.id },
      updates,
      { new: true },
    );
    if (!prescription) return res.status(404).json({ message: 'Not found' });
    res.json(prescription);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Latest prescription the physio issued for a session (null if none) — lets the portal
// show "Prescribed" / "Prescribe again" after a reload.
router.get('/session/:sessionId', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const prescription = await Prescription.findOne({ sessionId: req.params.sessionId, physiologistId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(prescription || null);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get patient's prescriptions
router.get('/mine', verifyToken, async (req, res) => {
  try {
    const prescriptions = await Prescription.find({ patientId: req.user.id })
      .populate('sessionId', 'slotDate slotTime')
      .sort({ createdAt: -1 });
    res.json(prescriptions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
