const Session = require('../models/sessionModel');
const recallService = require('./recallService');
const summaryService = require('./summaryService');

const sleep = ms => new Promise(r => setTimeout(r, ms));

// Fetch transcript → summarise → save. Idempotent: the atomic claim makes
// retried / duplicate triggers (bot.done + transcript.done + scheduler) a no-op.
async function processTranscript(sessionId, botId) {
  // A bot that left without ever recording (lobby timeout, kicked) has no
  // transcript — flag it for retry instead of running the pipeline.
  try {
    const bot = await recallService.getBot(botId);
    if (!recallService.hasRecorded(bot)) {
      await Session.updateOne(
        { _id: sessionId, transcriptText: { $in: ['', null] }, recallStatus: { $ne: 'processing' } },
        { recallStatus: 'needs_retry' },
      );
      return;
    }
  } catch (err) {
    console.error('Recall bot lookup failed:', err.message);
    return;
  }

  const claimed = await Session.findOneAndUpdate(
    { _id: sessionId, transcriptText: { $in: ['', null] }, recallStatus: { $ne: 'processing' } },
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

    if (!transcript) {
      await Session.findByIdAndUpdate(sessionId, {
        recallStatus: 'done_no_transcript',
        // Keep a more specific earlier reason (e.g. not admitted from the lobby).
        recallError: claimed.recallError || (transcript === null
          ? 'Recording finished but the transcript was not available.'
          : 'Recording finished but no speech was captured (were captions available?).'),
      });
      return;
    }

    const aiSummary = await summaryService.generateSummary(transcript, claimed.complaints);
    await Session.findByIdAndUpdate(sessionId, {
      transcriptText: transcript,
      aiSummary,
      status: 'summarised',
      recallStatus: 'transcribed',
      recallError: '',
    });
  } catch (err) {
    console.error('Transcript processing error:', err.message);
    await Session.findByIdAndUpdate(sessionId, {
      recallStatus: 'failed',
      recallError: `Transcript processing failed: ${err.message}`,
    });
  }
}

module.exports = { processTranscript };
