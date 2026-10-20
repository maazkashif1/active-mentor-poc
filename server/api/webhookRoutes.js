const express = require('express');
const { Webhook } = require('svix');
const Session = require('../models/sessionModel');
const { processTranscript, isBotProcessed } = require('../services/transcriptService');

const router = express.Router();

// [OLD — wrong] Route needs :sessionId in the URL, but Recall webhooks are
// registered once in the dashboard (no per-bot URL), so this was never called.
// It also only understood the legacy `bot.status_change` payload, ignored
// failures (bot never admitted, fatal errors) and wasn't idempotent.
//
// router.post('/recall/:sessionId', express.raw({ type: 'application/json' }), async (req, res) => {
//   // Verify Svix signature
//   try {
//     const wh = new Webhook(process.env.RECALL_WEBHOOK_SECRET);
//     wh.verify(req.body, {
//       'svix-id': req.headers['svix-id'],
//       'svix-timestamp': req.headers['svix-timestamp'],
//       'svix-signature': req.headers['svix-signature'],
//     });
//   } catch {
//     return res.status(400).json({ message: 'Invalid signature' });
//   }
//
//   res.sendStatus(200); // acknowledge immediately
//
//   // Process async
//   const { event, data } = JSON.parse(req.body);
//   if (event !== 'bot.status_change' || data?.status?.code !== 'done') return;
//
//   try {
//     const session = await Session.findById(req.params.sessionId);
//     if (!session || !session.recallBotId) return;
//
//     const transcript = await recallService.getTranscript(session.recallBotId);
//     const aiSummary = await summaryService.generateSummary(transcript, session.complaints);
//
//     session.transcriptText = transcript;
//     session.aiSummary = aiSummary;
//     session.status = 'summarised';
//     await session.save();
//   } catch (err) {
//     console.error('Webhook processing error:', err.message);
//   }
// });

// Sadaan Attempt
// Single endpoint registered in the Recall dashboard:
//   https://<render-app>/api/webhook/recall
// Subscribe it to bot.* status events (at least bot.in_waiting_room,
// bot.in_call_recording, bot.call_ended, bot.done, bot.fatal) and transcript.done.
// The `/recall/:sessionId` form is still accepted for backwards compatibility.

// Normalise new (`bot.done`, data.bot.id, data.data.code) and legacy
// (`bot.status_change`, data.bot_id, data.status.code) payload shapes.
function parseEvent(payload) {
  const { event, data = {} } = payload;
  const code = data.data?.code ?? data.status?.code ?? null;
  const subCode = data.data?.sub_code ?? data.status?.sub_code ?? null;
  return {
    event: event === 'bot.status_change' && code ? `bot.${code}` : event,
    botId: data.bot?.id ?? data.bot_id ?? null,
    metaSessionId: data.bot?.metadata?.sessionId ?? null,
    subCode,
  };
}

async function findSession({ botId, metaSessionId }, paramSessionId) {
  if (botId) {
    const s = await Session.findOne({ recallBotId: botId });
    if (s) return s;
  }
  const id = metaSessionId || paramSessionId;
  return id ? Session.findById(id).catch(() => null) : null;
}

router.post(['/recall', '/recall/:sessionId'], express.raw({ type: 'application/json' }), async (req, res) => {
  // Verify Svix signature
  try {
    // Recall signs with either `svix-*` or the standard `webhook-*` header names;
    // the svix library accepts both when given all request headers.
    new Webhook(process.env.RECALL_WEBHOOK_SECRET).verify(req.body, req.headers);
  } catch (err) {
    console.warn(`[recall-webhook] rejected: ${err.message}`);
    return res.status(400).json({ message: 'Invalid signature' });
  }

  res.sendStatus(200); // acknowledge immediately

  try {
    const parsed = parseEvent(JSON.parse(req.body));
    if (!parsed.event?.startsWith('bot.') && parsed.event !== 'transcript.done') return;

    const session = await findSession(parsed, req.params.sessionId);
    if (!session) return;
    const botId = parsed.botId || session.recallBotId;

    if (parsed.event === 'bot.done' || parsed.event === 'transcript.done') {
      await processTranscript(session._id, botId);
      return;
    }

    // Status events only matter for the session's current, not-yet-processed bot, and never
    // overwrite the transcript pipeline's own state or a signed-off session.
    if (botId !== session.recallBotId || isBotProcessed(session, botId)) return;
    if (session.status === 'approved' || ['processing', 'retry_processing'].includes(session.recallStatus)) return;

    const update = { recallStatus: parsed.event };
    if (parsed.event === 'bot.fatal') {
      update.recallStatus = 'needs_retry'; // retried by the scheduler, capped by MAX_ATTEMPTS
      update.recallError = `Bot error: ${parsed.subCode || 'unknown'}`;
    } else if (parsed.event === 'bot.call_ended' && /waiting_room|noone_joined|kicked/.test(parsed.subCode || '')) {
      // Retryable: the scheduler / next "Start session" sends a fresh bot.
      update.recallStatus = 'needs_retry';
      update.recallError = /waiting_room|kicked/.test(parsed.subCode)
        ? 'Scribe bot was not admitted from the Google Meet lobby.'
        : 'Nobody joined the meeting before the scribe bot timed out.';
    } else if (parsed.event === 'bot.recording_permission_denied') {
      update.recallError = 'Recording permission was denied in the meeting.';
    }
    await Session.findByIdAndUpdate(session._id, update);
  } catch (err) {
    console.error('Webhook processing error:', err.message);
  }
});

module.exports = router;
