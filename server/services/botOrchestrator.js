const Session = require('../models/sessionModel');
const recallService = require('./recallService');
const { processTranscript, isBotProcessed } = require('./transcriptService');

const MAX_ATTEMPTS = 3;
const LOCK_MS = 60 * 1000;
const SCHEDULED_SLACK_MS = 90 * 1000; // a scheduled bot joining within this is "about to join"

const LIVE_CODES = new Set([
  'joining_call', 'in_waiting_room', 'in_call_not_recording',
  'recording_permission_allowed', 'in_call_recording',
]);

const errText = e => (e.response?.data ? JSON.stringify(e.response.data) : e.message);

// Makes sure a live (or imminently joining) Recall bot exists for the session.
//   now: true  → the meeting is starting right now; the bot must join immediately.
//   now: false → booking / scheduler path; the bot is scheduled for the slot time.
// Returns { state } where state is one of:
//   'no_meeting_link' | 'busy' | 'live' | 'scheduled' | 'created' | 'recorded'
//   | 'exhausted' | 'create_failed' | 'skipped' | 'ended' | 'locked'
// 'recorded' = the bot recorded and has finished; the caller should process the transcript.
async function ensureBot(sessionId, { now = false, resetAttempts = false } = {}) {
  // Short-lived atomic lock so concurrent triggers (start button, scheduler,
  // booking) cannot send duplicate bots.
  const session = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      $or: [{ recallLockUntil: null }, { recallLockUntil: { $lt: new Date() } }],
    },
    { recallLockUntil: new Date(Date.now() + LOCK_MS), ...(resetAttempts && { recallAttempts: 0 }) },
    { new: true },
  );
  if (!session) return { state: 'busy' };

  try {
    return await run(session, now);
  } finally {
    await Session.updateOne({ _id: sessionId }, { recallLockUntil: null });
  }
}

async function run(session, now) {
  if (!session.meetingUrl) return { state: 'no_meeting_link' };
  // Approved = signed off: the note is final and no scribe joins again.
  if (session.status === 'approved') return { state: 'locked' };
  // Automatic paths (booking / scheduler) only ever record a session once. Only an explicit
  // physio Start (`now`) resumes a session that already has a recording.
  const hasRecording = !!session.transcriptText || (session.recordings || []).length > 0;
  if (!now && (hasRecording || ['processing', 'transcribed', 'done_no_transcript'].includes(session.recallStatus))) {
    return { state: 'skipped' };
  }

  // Inspect the existing bot, if any.
  if (session.recallBotId) {
    let bot;
    try {
      bot = await recallService.getBot(session.recallBotId);
    } catch (e) {
      console.error('Recall bot lookup failed:', errText(e));
      await Session.updateOne({ _id: session._id }, { recallError: `Bot lookup failed: ${errText(e)}` });
      return { state: 'busy' };
    }

    const code = recallService.latestCode(bot);
    if (code && LIVE_CODES.has(code)) {
      await Session.updateOne({ _id: session._id }, { recallStatus: `bot.${code}` });
      return { state: 'live' };
    }

    if (!code || code === 'ready') {
      // Scheduled / created, not joined yet. If we need the bot *now* but it is queued for later, replace it.
      const joinAt = bot.join_at ? new Date(bot.join_at).getTime() : null;
      if (!now || !joinAt || joinAt - Date.now() <= SCHEDULED_SLACK_MS) return { state: 'scheduled' };
      await recallService.deleteBot(session.recallBotId);
    } else if (recallService.hasRecorded(bot)) {
      // Finished a real recording.
      if (!isBotProcessed(session, session.recallBotId)) {
        if (!now) return { state: 'recorded' }; // caller runs the transcript pipeline
        // Resuming before the earlier part was processed: finish it in the background.
        processTranscript(session._id, session.recallBotId)
          .catch(e => console.error('Transcript processing failed:', e.message));
      } else if (!now) {
        return { state: 'skipped' };
      }
      // Resume: keep the earlier recording (seed `recordings` for sessions transcribed
      // before it existed) and fall through to send a new bot.
      if (!(session.recordings || []).length && session.transcriptText) {
        await Session.updateOne(
          { _id: session._id, 'recordings.0': { $exists: false } },
          { recordings: [{ botId: session.recallBotId, transcript: session.transcriptText, createdAt: session.updatedAt }] },
        );
      }
    }
    // else: bot left without recording (timeout / kicked / fatal) → fall through and retry
  }

  // The physio ended the session: never send another bot.
  if (session.endedAt) return { state: 'ended' };

  if (session.recallAttempts >= MAX_ATTEMPTS) {
    await Session.updateOne(
      { _id: session._id },
      {
        recallStatus: 'failed',
        recallError: session.recallError || 'Scribe bot could not join the meeting after several attempts.',
      },
    );
    return { state: 'exhausted' };
  }

  try {
    const { botId, joinAt } = await recallService.createBot({
      meetingUrl: session.meetingUrl,
      sessionId: session._id,
      startAt: now ? null : session.scheduledStart,
    });
    await Session.updateOne(
      { _id: session._id },
      {
        recallBotId: botId,
        recallStatus: joinAt ? 'scheduled' : 'joining',
        recallError: '',
        $inc: { recallAttempts: 1 },
      },
    );
    return { state: 'created' };
  } catch (e) {
    console.error('Recall bot creation failed:', errText(e));
    await Session.updateOne(
      { _id: session._id },
      { recallStatus: 'create_failed', recallError: `Bot creation failed: ${errText(e)}`, $inc: { recallAttempts: 1 } },
    );
    return { state: 'create_failed' };
  }
}

module.exports = { ensureBot, MAX_ATTEMPTS };
