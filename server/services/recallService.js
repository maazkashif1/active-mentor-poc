const axios = require('axios');

const RECALL_BASE = 'https://ap-northeast-1.recall.ai/api/v1';

function headers() {
  return {
    Authorization: `Token ${process.env.RECALL_API_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function createBot(meetingUrl, sessionId) {
  const webhookUrl = `${process.env.RECALL_WEBHOOK_BASE_URL}/api/webhook/recall/${sessionId}`;
  const { data } = await axios.post(
    `${RECALL_BASE}/bot/`,
    {
      meeting_url: meetingUrl,
      bot_name: 'Active Mentor Scribe',
      transcription_options: { provider: 'meeting_captions' },
      webhook_settings: { url: webhookUrl },
    },
    { headers: headers() },
  );
  return data.id;
}

async function getTranscript(botId) {
  const { data } = await axios.get(`${RECALL_BASE}/bot/${botId}/transcript/`, { headers: headers() });
  return data
    .map(entry => `${entry.speaker}: ${entry.words.map(w => w.text).join(' ')}`)
    .join('\n');
}

module.exports = { createBot, getTranscript };
