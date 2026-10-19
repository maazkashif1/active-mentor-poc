const Session = require('../models/sessionModel');
const { ensureBot } = require('./botOrchestrator');
const { processTranscript } = require('./transcriptService');
const { slotToDate } = require('./timeService');

const TICK_MS = 60 * 1000;
const LEAD_MS = 2 * 60 * 1000;            // send the bot this long before the slot starts
const WINDOW_MS = 90 * 60 * 1000;         // keep (re)trying for this long after the slot start
const STUCK_PROCESSING_MS = 10 * 60 * 1000;
// Pipeline already finished (or given up) — nothing left to do.
const FINAL = ['transcribed', 'processing', 'done_no_transcript', 'failed', 'no_meeting_link'];

let running = false;

async function tick() {
  if (running) return;
  running = true;
  try {
    const now = Date.now();

    // 0) Backfill scheduledStart for sessions booked before that field existed.
    const legacy = await Session.find({ scheduledStart: null, status: { $in: ['pending', 'active'] } })
      .select('_id slotDate slotTime');
    for (const s of legacy) {
      await Session.updateOne({ _id: s._id }, { scheduledStart: slotToDate(s.slotDate, s.slotTime) });
    }

    // 1) Sessions starting soon / in progress that need a live bot, a retry, or a transcript.
    const due = await Session.find({
      status: { $in: ['pending', 'active'] },
      meetingUrl: { $nin: ['', null] },
      transcriptText: { $in: ['', null] },
      scheduledStart: { $lte: new Date(now + LEAD_MS), $gte: new Date(now - WINDOW_MS) },
      recallStatus: { $nin: FINAL },
    }).select('_id recallBotId');

    for (const s of due) {
      const { state } = await ensureBot(s._id);
      if (state === 'recorded') await processTranscript(s._id, s.recallBotId);
    }

    // 2) Bots that recorded but whose webhook never arrived (session already past the retry window).
    const orphaned = await Session.find({
      recallBotId: { $nin: ['', null] },
      transcriptText: { $in: ['', null] },
      recallStatus: { $nin: [...FINAL, 'scheduled', 'joining'] },
      scheduledStart: { $gte: new Date(now - 6 * 60 * 60 * 1000), $lt: new Date(now - WINDOW_MS) },
    }).select('_id recallBotId');
    for (const s of orphaned) await processTranscript(s._id, s.recallBotId);

    // 3) Pipeline stuck in 'processing' (e.g. server restarted mid-run) → reset and re-run.
    const stuck = await Session.find({
      recallStatus: 'processing',
      processingStartedAt: { $lt: new Date(now - STUCK_PROCESSING_MS) },
    }).select('_id recallBotId');
    for (const s of stuck) {
      await Session.updateOne({ _id: s._id, recallStatus: 'processing' }, { recallStatus: 'retry_processing' });
      processTranscript(s._id, s.recallBotId).catch(e => console.error('Re-processing failed:', e.message));
    }
  } catch (err) {
    console.error('Recall scheduler error:', err.message);
  } finally {
    running = false;
  }
}

function startRecallScheduler() {
  setInterval(tick, TICK_MS);
  tick();
  console.log('Recall scheduler started');
}

module.exports = { startRecallScheduler };
