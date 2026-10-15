const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/userModel');
const verifyToken = require('../middleware/auth');

const router = express.Router();

function signToken(user) {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '30d' });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, specialty, bio, yearsExperience, education } = req.body;
    if (await User.findOne({ email })) {
      return res.status(409).json({ message: 'Email already registered' });
    }
    const user = await User.create({
      name, email, password, role: role || 'patient',
      specialty, bio, yearsExperience, education,
    });
    res.status(201).json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    res.json({ token: signToken(user), user: { id: user._id, name: user.name, email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Save onboarding / patient profile data
router.patch('/profile', verifyToken, async (req, res) => {
  try {
    const { firstName, dob, city, careArea, side, onboardingAnswers } = req.body;
    const update = {};
    if (firstName) update.firstName = firstName;
    if (dob)       update.dob = dob;
    if (city)      update.city = city;
    if (careArea)  update.careArea = careArea;
    if (side)      update.side = side;
    if (onboardingAnswers) update.onboardingAnswers = onboardingAnswers;
    const user = await User.findByIdAndUpdate(req.user.id, update, { new: true }).select('-password');
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
