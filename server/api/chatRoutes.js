const express = require('express');
const verifyToken = require('../middleware/auth');
const ChatThread = require('../models/chatThreadModel');
const ChatMessage = require('../models/chatMessageModel');
const User = require('../models/userModel');
const { assertThreadAccess } = require('../services/chatAccess');

const router = express.Router();

function serializeThread(thread, viewerRole) {
  const t = thread.toObject ? thread.toObject() : thread;
  const unread =
    viewerRole === 'patient' ? t.patientUnread || 0 : t.physiologistUnread || 0;
  return { ...t, unread };
}

// GET /api/chat/threads
router.get('/threads', verifyToken, async (req, res) => {
  try {
    const filter =
      req.user.role === 'patient'
        ? { patientId: req.user.id }
        : { physiologistId: req.user.id };

    const threads = await ChatThread.find(filter)
      .populate('patientId', 'name email firstName')
      .populate('physiologistId', 'name email specialty photo')
      .sort({ lastMessageAt: -1 });

    res.json(threads.map(t => serializeThread(t, req.user.role)));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/threads  { physiologistId } | { patientId }
router.post('/threads', verifyToken, async (req, res) => {
  try {
    let patientId;
    let physiologistId;

    if (req.user.role === 'patient') {
      patientId = req.user.id;
      physiologistId = req.body.physiologistId;
      if (!physiologistId) return res.status(400).json({ message: 'physiologistId required' });
      const physio = await User.findOne({ _id: physiologistId, role: 'physiologist' });
      if (!physio) return res.status(404).json({ message: 'Physiologist not found' });
    } else if (req.user.role === 'physiologist') {
      physiologistId = req.user.id;
      patientId = req.body.patientId;
      if (!patientId) return res.status(400).json({ message: 'patientId required' });
      const patient = await User.findOne({ _id: patientId, role: 'patient' });
      if (!patient) return res.status(404).json({ message: 'Patient not found' });
    } else {
      return res.status(403).json({ message: 'Forbidden' });
    }

    let thread = await ChatThread.findOne({ patientId, physiologistId });
    if (!thread) {
      thread = await ChatThread.create({ patientId, physiologistId });
    }

    await thread.populate('patientId', 'name email firstName');
    await thread.populate('physiologistId', 'name email specialty photo');
    res.json(serializeThread(thread, req.user.role));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// GET /api/chat/threads/:id/messages
router.get('/threads/:id/messages', verifyToken, async (req, res) => {
  try {
    const { thread, error } = await assertThreadAccess(req.params.id, req.user);
    if (error) return res.status(error.status).json({ message: error.message });

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const filter = { threadId: thread._id };
    if (req.query.before) filter.createdAt = { $lt: new Date(req.query.before) };

    const messages = await ChatMessage.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json(messages.reverse());
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// POST /api/chat/threads/:id/messages  { body }
router.post('/threads/:id/messages', verifyToken, async (req, res) => {
  try {
    const text = String(req.body.body || '').trim();
    if (!text) return res.status(400).json({ message: 'Message body required' });

    const { thread, error } = await assertThreadAccess(req.params.id, req.user);
    if (error) return res.status(error.status).json({ message: error.message });

    const message = await ChatMessage.create({
      threadId: thread._id,
      senderId: req.user.id,
      senderRole: req.user.role,
      body: text,
    });

    thread.lastMessageAt = message.createdAt;
    thread.lastMessagePreview = text.slice(0, 140);
    thread.lastSenderRole = req.user.role;
    if (req.user.role === 'patient') thread.physiologistUnread = (thread.physiologistUnread || 0) + 1;
    else thread.patientUnread = (thread.patientUnread || 0) + 1;
    await thread.save();

    const io = req.app.get('io');
    if (io) {
      const payload = {
        message,
        threadId: String(thread._id),
        patientId: String(thread.patientId),
        physiologistId: String(thread.physiologistId),
      };
      io.to(`thread:${thread._id}`).emit('message:new', payload);
      io.to(`user:${thread.patientId}`).emit('thread:updated', { threadId: String(thread._id) });
      io.to(`user:${thread.physiologistId}`).emit('thread:updated', { threadId: String(thread._id) });
    }

    res.status(201).json(message);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// PATCH /api/chat/threads/:id/read
router.patch('/threads/:id/read', verifyToken, async (req, res) => {
  try {
    const { thread, error } = await assertThreadAccess(req.params.id, req.user);
    if (error) return res.status(error.status).json({ message: error.message });

    if (req.user.role === 'patient') thread.patientUnread = 0;
    else thread.physiologistUnread = 0;
    await thread.save();

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
