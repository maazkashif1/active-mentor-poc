const Session = require('../models/sessionModel');
const recallService = require('./recallService');
const summaryService = require('./summaryService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Line inserted between recordings when a session is resumed (the portal renders it as a divider).
const RESUME_MARKER = '— Session resumed —';

// Recall states that mean "a bot is in the call or its recording is still being processed".
const IN_PROGRESS_STATUSES = [
  'creating', 'joining', 'bot.joining_call', 'bot.in_waiting_room', 'bot.in_call_not_recording',
  'bot.in_call_recording', 'bot.call_ended', 'bot.recording_done', 'bot.done', 'processing', 'retry_processing',
];

// True once this bot's recording has been added to the session's transcript.
function isBotProcessed(session, botId) {
  const recordings = session?.recordings || [];
  if (recordings.some(r => r.botId === botId)) return true;
  // Sessions transcribed before `recordings` existed: their current bot is the one transcribed.
  return !recordings.length && !!session?.transcriptText && session.recallBotId === botId;
}

function joinRecordings(recordings) {
  return recordings
    .map(r => (r.transcript || '').trim())
    .filter(Boolean)
    .join(`\n${RESUME_MARKER}\n`);
}

// The current bot ended without recording anything (not admitted, or the session was
// ended first). Keep any existing transcript/summary; otherwise flag the right next step.
async function noNewRecording(sessionId, botId) {
  const s = await Session.findById(sessionId);
  if (!s || s.recallBotId !== botId || isBotProcessed(s, botId)) return;
  if (['processing', 'retry_processing'].includes(s.recallStatus)) return;

  if (s.transcriptText) {
    await Session.updateOne({ _id: sessionId }, {
      recallStatus: 'transcribed',
      status: s.status === 'approved' ? 'approved' : 'summarised',
      recallError: 'The scribe did not record anything new (it was not admitted, or the session was ended first), so the transcript and summary are unchanged.',
    });
  } else if (s.endedAt) {
    await Session.updateOne({ _id: sessionId }, {
      recallStatus: 'done_no_transcript',
      recallError: 'The session was ended before the scribe started recording, so there is no transcript.',
    });
  } else {
    // First recording never happened and the session is still open: let the scheduler retry.
    await Session.updateOne({ _id: sessionId }, { recallStatus: 'needs_retry' });
  }
}

// Fetch one bot's transcript → append it to the session → regenerate the SOAP summary from
// the whole conversation. Idempotent per bot: duplicate triggers (webhooks, watcher,
// scheduler) are no-ops once the bot is in `recordings`.
async function processTranscript(sessionId, botId) {
  let bot;
  try {
    bot = await recallService.getBot(botId);
  } catch (err) {
    console.error('Recall bot lookup failed:', err.message);
    return;
  }
  if (!recallService.hasRecorded(bot)) {
    await noNewRecording(sessionId, botId);
    return;
  }

  const current = await Session.findById(sessionId);
  if (!current || current.status === 'approved' || isBotProcessed(current, botId)) return;

  const claimed = await Session.findOneAndUpdate(
    {
      _id: sessionId,
      status: { $ne: 'approved' },
      'recordings.botId': { $ne: botId },
      recallStatus: { $nin: ['processing'] },
    },
    { recallStatus: 'processing', processingStartedAt: new Date() },
    { new: true },
  );
  if (!claimed) return;

  try {
    // The transcript artifact can lag the `done` event slightly — retry.
    let transcript = null;
    for (let attempt = 0; attempt < 6 && transcript === null; attempt++) {
      if (attempt) await sleep(15000);
      transcript = await recallService.getTranscript(botId);
    }

    const previous = claimed.recordings?.length
      ? claimed.recordings.map(r => ({ botId: r.botId, transcript: r.transcript, createdAt: r.createdAt }))
      : (claimed.transcriptText ? [{ botId: 'legacy', transcript: claimed.transcriptText, createdAt: claimed.updatedAt }] : []);
    const recordings = [...previous, { botId, transcript: transcript || '', createdAt: new Date() }];
    const combined = joinRecordings(recordings);
    const hadTranscript = !!joinRecordings(previous);

    if (!transcript) {
      // Nothing usable in this recording: keep what we had.
      await Session.findByIdAndUpdate(sessionId, hadTranscript
        ? {
          recordings,
          recallStatus: 'transcribed',
          status: 'summarised',
          recallError: 'The latest recording had no speech, so the transcript and summary are unchanged.',
        }
        : {
          recordings,
          recallStatus: 'done_no_transcript',
          // Keep a more specific earlier reason (e.g. not admitted from the lobby).
          recallError: claimed.recallError || (transcript === null
            ? 'Recording finished but the transcript was not available.'
            : 'Recording finished but no speech was captured (were captions available?).'),
        });
      return;
    }

    // Save the transcript first so it is never lost if summarisation fails.
    await Session.findByIdAndUpdate(sessionId, { recordings, transcriptText: combined });
    try {
      const aiSummary = await summaryService.generateSummary(combined, claimed.complaints);
      await Session.findByIdAndUpdate(sessionId, {
        aiSummary,
        status: 'summarised',
        recallStatus: 'transcribed',
        recallError: '',
      });
    } catch (err) {
      console.error('Summary generation error:', err.message);
      await Session.findByIdAndUpdate(sessionId, {
        status: 'summarised',
        recallStatus: 'transcribed',
        recallError: `Transcript saved, but the AI summary failed: ${err.message}`,
      });
    }
  } catch (err) {
    console.error('Transcript processing error:', err.message);
    await Session.findByIdAndUpdate(sessionId, {
      recallStatus: 'failed',
      recallError: `Transcript processing failed: ${err.message}`,
      // A resumed session keeps its earlier transcript reviewable.
      ...(claimed.transcriptText && { status: 'summarised' }),
    });
  }
}

module.exports = {
  processTranscript,
  noNewRecording,
  isBotProcessed,
  RESUME_MARKER,
  IN_PROGRESS_STATUSES,
};
