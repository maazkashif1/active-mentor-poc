// Follows a bot after the physio ends the session: waits for Recall to finish the
// recording, then runs the transcript pipeline. Works without webhooks. The scheduler
// calls finalizeEndedBot() too, so a server restart mid-watch loses nothing.
const Session = require('../models/sessionModel');
const recallService = require('./recallService');
const { processTranscript } = require('./transcriptService');

const POLL_MS = 10 * 1000;
const MAX_WATCH_MS = 5 * 60 * 1000;
const PIPELINE_STATES = ['processing', 'retry_processing', 'transcribed', 'done_no_transcript'];

const watching = new Set(); // bot ids watched by this process
const sleep = ms => new Promise(r => setTimeout(r, ms));

// One check of an ended session's bot. Returns true once the bot is finished and handed
// to the transcript pipeline (or marked as having nothing to transcribe).
async function finalizeEndedBot(sessionId, botId) {
  const bot = await recallService.getBot(botId);
  const code = recallService.latestCode(bot);

  if (code) {
    // Don't overwrite the transcript pipeline's own states.
    await Session.updateOne(
      { _id: sessionId, recallBotId: botId, recallStatus: { $nin: PIPELINE_STATES } },
      { recallStatus: `bot.${code}` },
    );
  }
  if (code !== 'done' && code !== 'fatal') return false;

  if (!recallService.hasRecorded(bot)) {
    await Session.updateOne(
      { _id: sessionId, transcriptText: { $in: ['', null] }, recallStatus: { $nin: PIPELINE_STATES } },
      {
        recallStatus: 'done_no_transcript',
        recallError: 'The session was ended before the scribe started recording, so there is no transcript.',
      },
    );
    return true;
  }
  await processTranscript(sessionId, botId);
  return true;
}

async function watch(sessionId, botId) {
  const deadline = Date.now() + MAX_WATCH_MS;
  while (Date.now() < deadline) {
    try {
      if (await finalizeEndedBot(sessionId, botId)) {
        console.log(`[end-session] session=${sessionId} bot=${botId} finished`);
        return;
      }
    } catch (err) {
      console.warn(`[end-session] session=${sessionId} bot lookup failed: ${err.message}`);
    }
    await sleep(POLL_MS);
  }
  console.warn(`[end-session] session=${sessionId} bot not finished after ${MAX_WATCH_MS / 1000}s; scheduler will continue`);
}

// Starts watching unless this bot is already being watched. Non-blocking.
function watchBot(sessionId, botId) {
  if (!botId || watching.has(botId)) return;
  watching.add(botId);
  watch(sessionId, botId)
    .catch(err => console.error(`[end-session] watcher error: ${err.message}`))
    .finally(() => watching.delete(botId));
}

module.exports = { watchBot, finalizeEndedBot };
