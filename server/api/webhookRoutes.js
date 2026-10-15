const express = require('express');
const { Webhook } = require('svix');
const Session = require('../models/sessionModel');
const recallService = require('../services/recallService');
const summaryService = require('../services/summaryService');

const router = express.Router();

router.post('/recall/:sessionId', express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify Svix signature
  try {
    const wh = new Webhook(process.env.RECALL_WEBHOOK_SECRET);
    wh.verify(req.body, {
      'svix-id': req.headers['svix-id'],
      'svix-timestamp': req.headers['svix-timestamp'],
      'svix-signature': req.headers['svix-signature'],
    });
  } catch {
    return res.status(400).json({ message: 'Invalid signature' });
  }

  res.sendStatus(200); // acknowledge immediately

  // Process async
  const { event, data } = JSON.parse(req.body);
  if (event !== 'bot.status_change' || data?.status?.code !== 'done') return;

  try {
    const session = await Session.findById(req.params.sessionId);
    if (!session || !session.recallBotId) return;

    const transcript = await recallService.getTranscript(session.recallBotId);
    const aiSummary = await summaryService.generateSummary(transcript, session.complaints);

    session.transcriptText = transcript;
    session.aiSummary = aiSummary;
    session.status = 'summarised';
    await session.save();
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

module.exports = router;
