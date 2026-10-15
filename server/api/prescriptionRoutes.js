const express = require('express');
const Prescription = require('../models/prescriptionModel');
const verifyToken = require('../middleware/auth');

const router = express.Router();

// Create prescription (physiologist only)
router.post('/', verifyToken, async (req, res) => {
  try {
    if (req.user.role !== 'physiologist') return res.status(403).json({ message: 'Forbidden' });
    const { sessionId, patientId, exerciseId, raiseAngleThreshold, lowerAngleThreshold, minAdaptedAngle, targetReps, notes } = req.body;
    const prescription = await Prescription.create({
      sessionId,
      patientId,
      physiologistId: req.user.id,
      exerciseId,
      raiseAngleThreshold,
      lowerAngleThreshold,
      minAdaptedAngle: minAdaptedAngle ?? null,
      targetReps,
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
    const prescription = await Prescription.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!prescription) return res.status(404).json({ message: 'Not found' });
    res.json(prescription);
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
