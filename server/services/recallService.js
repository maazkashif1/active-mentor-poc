const axios = require('axios');

// [OLD — wrong] Region hard-coded; Recall API keys only work in their own region.
// const RECALL_BASE = 'https://ap-northeast-1.recall.ai/api/v1';

// Sadaan Attempt
// Region is configurable so it can match the workspace the API key belongs to
// (us-east-1, us-west-2, eu-central-1, ap-northeast-1).
const RECALL_REGION = process.env.RECALL_REGION || 'ap-northeast-1';
const RECALL_BASE = process.env.RECALL_API_BASE || `https://${RECALL_REGION}.recall.ai/api/v1`;

function headers() {
  return {
    Authorization: `Token ${process.env.RECALL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

// [OLD — wrong] No `join_at`, so the bot was dispatched the moment the patient
// booked, sat in an empty Meet lobby, timed out and left before the consultation.
// `transcription_options` is the legacy transcription param and `webhook_settings`
// is not how Recall registers status webhooks (that is done in the dashboard).
//
// async function createBot(meetingUrl, sessionId) {
//   const webhookUrl = `${process.env.RECALL_WEBHOOK_BASE_URL}/api/webhook/recall/${sessionId}`;
//   const { data } = await axios.post(
//     `${RECALL_BASE}/bot/`,
//     {
//       meeting_url: meetingUrl,
//       bot_name: 'Active Mentor Scribe',
//       transcription_options: { provider: 'meeting_captions' },
//       webhook_settings: { url: webhookUrl },
//     },
//     { headers: headers() },
//   );
//   return data.id;
// }

// Sadaan Attempt
// Recall only guarantees scheduled bots created at least 10 min ahead; anything
// closer is sent as an ad-hoc bot (join immediately).
const MIN_SCHEDULE_LEAD_MS = 10 * 60 * 1000;
const JOIN_EARLY_MS = 2 * 60 * 1000; // be in the lobby ~2 min before start

// RECALL_TRANSCRIPT_PROVIDER=meeting_captions (default) | recallai_streaming
// recallai_streaming uses Recall's own ASR (better for Urdu / mixed-language calls).
function transcriptProvider() {
  if (process.env.RECALL_TRANSCRIPT_PROVIDER === 'recallai_streaming') {
    return {
      recallai_streaming: {
        language_code: process.env.RECALL_TRANSCRIPT_LANGUAGE || 'auto',
        mode: 'prioritize_accuracy',
      },
    };
  }
  return { meeting_captions: {} };
}

// startAt omitted/null => ad-hoc bot that joins immediately ("session started now").
async function createBot({ meetingUrl, sessionId, startAt }) {
  const body = {
    meeting_url: meetingUrl,
    bot_name: 'Active Mentor Scribe',
    recording_config: {
      transcript: { provider: transcriptProvider() },
    },
    automatic_leave: {
      waiting_room_timeout: 15 * 60, // time for the physio to click "Admit"
      noone_joined_timeout: 15 * 60,
      everyone_left_timeout: { timeout: 120 },
    },
    // Lets the webhook map a bot back to its session.
    metadata: { sessionId: String(sessionId) },
  };

  if (startAt) {
    const joinAt = new Date(startAt.getTime() - JOIN_EARLY_MS);
    if (joinAt.getTime() - Date.now() >= MIN_SCHEDULE_LEAD_MS) {
      body.join_at = joinAt.toISOString();
    }
  }

  const { data } = await axios.post(`${RECALL_BASE}/bot/`, body, { headers: headers() });
  return { botId: data.id, joinAt: body.join_at || null };
}

// [OLD — wrong] Legacy transcript endpoint; bots created with `recording_config`
// expose the transcript as a recording artifact instead.
//
// async function getTranscript(botId) {
//   const { data } = await axios.get(`${RECALL_BASE}/bot/${botId}/transcript/`, { headers: headers() });
//   return data
//     .map(entry => `${entry.speaker}: ${entry.words.map(w => w.text).join(' ')}`)
//     .join('\n');
// }

// Sadaan Attempt
// Returns the formatted transcript, or null if it isn't ready yet.
async function getTranscript(botId) {
  const { data: bot } = await axios.get(`${RECALL_BASE}/bot/${botId}/`, { headers: headers() });
  const downloadUrl = bot.recordings?.[0]?.media_shortcuts?.transcript?.data?.download_url;
  if (!downloadUrl) return null;

  // Presigned URL — must be fetched without the Authorization header.
  const { data: entries } = await axios.get(downloadUrl);
  return (entries || [])
    .map(entry => `${entry.participant?.name || 'Unknown'}: ${(entry.words || []).map(w => w.text).join(' ')}`)
    .filter(line => line.trim())
    .join('\n');
}

async function getBot(botId) {
  const { data } = await axios.get(`${RECALL_BASE}/bot/${botId}/`, { headers: headers() });
  return data;
}

// Removes a scheduled bot (or asks an in-call bot to leave). Errors are non-fatal.
async function deleteBot(botId) {
  try {
    await axios.delete(`${RECALL_BASE}/bot/${botId}/`, { headers: headers() });
  } catch (e) {
    console.error('Recall bot delete failed:', e.response?.data ? JSON.stringify(e.response.data) : e.message);
  }
}

// Latest lifecycle code of a bot, e.g. in_waiting_room, in_call_recording, done. null = not joined yet.
function latestCode(bot) {
  const changes = bot?.status_changes || [];
  return changes.length ? changes[changes.length - 1].code : null;
}

// True if the bot ever started recording (so a transcript can exist).
function hasRecorded(bot) {
  return (bot?.status_changes || []).some(c => c.code === 'in_call_recording');
}

module.exports = { createBot, getTranscript, getBot, deleteBot, latestCode, hasRecorded };
