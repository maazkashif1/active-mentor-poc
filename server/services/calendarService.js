const { google } = require('googleapis');

function makeOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI,
  );
}

function getAuthUrl(stateToken) {
  return makeOAuth2Client().generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: stateToken,
  });
}

async function exchangeCode(code) {
  const client = makeOAuth2Client();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// [OLD] async function createMeeting({ tokens, summary, startISO, endISO, attendeeEmails }) {
// Sadaan Attempt
// Accepts `timeZone` so the invite is shown in the physio's local time.
async function createMeeting({ tokens, summary, startISO, endISO, attendeeEmails, timeZone }) {
  const client = makeOAuth2Client();
  client.setCredentials(tokens);
  client.on('tokens', newTokens => { client._newTokens = newTokens; });

  const calendar = google.calendar({ version: 'v3', auth: client });
  const { data } = await calendar.events.insert({
    calendarId: 'primary',
    conferenceDataVersion: 1,
    sendUpdates: 'all',
    resource: {
      summary,
      // [OLD]
      // start: { dateTime: startISO },
      // end: { dateTime: endISO },
      // Sadaan Attempt
      start: { dateTime: startISO, ...(timeZone && { timeZone }) },
      end: { dateTime: endISO, ...(timeZone && { timeZone }) },
      attendees: attendeeEmails.map(email => ({ email })),
      conferenceData: {
        createRequest: { requestId: `meet-${Date.now()}`, conferenceSolutionKey: { type: 'hangoutsMeet' } },
      },
    },
  });

  return {
    meetingUrl: data.hangoutLink,
    eventId: data.id,
    newTokens: client._newTokens || null,
  };
}

module.exports = { getAuthUrl, exchangeCode, createMeeting };
