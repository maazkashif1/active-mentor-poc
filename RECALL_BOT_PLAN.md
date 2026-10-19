# Recall Scribe Bot — Problems & Implementation Plan

**Goal:** when a consultation's Google Meet starts, the "Active Mentor Scribe" bot joins, records,
and transcribes it. The transcript and AI summary then appear on the session page.

**Status:** analysis only. No code has been changed yet.

---

## 1. Current flow (as implemented on `sadaanattempt`)

```
Patient books slot ──► POST /api/sessions/book            (server/api/sessionRoutes.js)
   │
   ├─ physio has Google tokens? ──no──► no meetingUrl ──► NO BOT, silently
   │        │ yes
   │        ▼
   │  calendarService.createMeeting() → Meet link       (errors swallowed, only console.error)
   │        ▼
   └─ scheduleRecallBot() → recallService.createBot()  (join_at = start − 1 min if ≥10 min ahead,
            │                                            otherwise joins immediately)
            ▼
       Recall bot ──(Svix webhooks)──► POST /api/webhook/recall   (server/api/webhookRoutes.js)
            ▼
       bot.done / transcript.done → getTranscript() → OpenAI summary → session.status='summarised'

Fallback: maybeActivate() runs only when someone GETs /sessions/physio, /my or /:id.
          If the session is "active" and has no bot, it creates one then.
```

Relevant files:

| File | Role |
|---|---|
| [server/services/recallService.js](server/services/recallService.js) | `createBot`, `getTranscript` (Recall REST) |
| [server/api/sessionRoutes.js](server/api/sessionRoutes.js) | Booking, Meet creation, `scheduleRecallBot`, `maybeActivate` fallback |
| [server/api/webhookRoutes.js](server/api/webhookRoutes.js) | Svix-verified Recall webhook, transcript and summary pipeline |
| [server/services/calendarService.js](server/services/calendarService.js) | Google Calendar event and Meet link creation |
| [server/models/sessionModel.js](server/models/sessionModel.js) | `recallBotId`, `recallStatus`, `recallError`, `scheduledStart` |
| [physiologist-portal/app/sessions/[id]/page.jsx](physiologist-portal/app/sessions/[id]/page.jsx) | Shows "Join Google Meet", scribe status and errors |
| [ActiveMentorPhysio/src/screens/consultation/MeetingScreen.tsx](ActiveMentorPhysio/src/screens/consultation/MeetingScreen.tsx) | Patient opens the Meet link |

---

## 2. Problems identified

Problems are ordered by how likely they are to stop the bot from ever appearing in the call.

### P1 — Recall region probably does not match the API key (high likelihood, blocks everything)
- `recallService.js` defaults to `RECALL_REGION=ap-northeast-1`, and `render.yaml` also hard-codes `ap-northeast-1`.
- `server/.env.local` has **no** `RECALL_REGION`. Most Recall accounts are created in `us-west-2`
  (pay-as-you-go) or `us-east-1`.
- A key used against the wrong region returns **401 / 404**. `scheduleRecallBot` catches this and only
  writes `recallStatus: 'create_failed'` and `recallError` to the DB. The bot is never created, and nothing
  shows the problem unless someone opens the session page.
- Webhooks are also registered **per region dashboard**. If the endpoint was added in a different region's
  dashboard, no events arrive.

### P2 — No meeting URL means no bot, and this fails silently (high likelihood)
- A bot is created only if `session.meetingUrl` is set. That requires the physio to have connected Google
  (`physio.googleTokens.refreshToken`).
- If the physio never connected Google, or Meet creation throws, the booking still succeeds with
  `meetingUrl = ''`. No bot is sent and no error is stored on the session (only `console.error`).
- **Google OAuth app in "Testing" mode:** refresh tokens expire after **7 days**. After that, every booking
  fails Meet creation with `invalid_grant`, so it gets no Meet link and no bot. Users see this as "the bot stopped working".

### P3 — The bot is tied to the *slot time*, not to the meeting actually starting
- The bot joins at `scheduledStart − 1 min`. If the physio starts late (more than 15 min), the bot hits
  `waiting_room_timeout` / `noone_joined_timeout` (15 min) and leaves. If the call starts early, the bot is not there yet.
- Nothing reacts to "the meeting has started". There is no start button, no Meet event, and no retry when a bot left early.

### P4 — The fallback is lazy and runs only once
- `maybeActivate()` runs only inside GET handlers. If nobody has the portal or app open at start time,
  the fallback never runs.
- The fallback claims only `''` / `create_failed`. After one failure it writes `failed`, and **no bot is ever retried**
  for that session.
- A bot that was created but left (lobby timeout, kicked, `bot.fatal`) keeps `recallBotId`, so the
  fallback (`!s.recallBotId`) never sends a replacement.

### P5 — Google Meet admission and access restrictions
- Recall bots join Meet **unauthenticated** (as a guest), so someone in the call must click **Admit**.
  If the physio is not in the call when the bot knocks, or ignores the prompt, the bot leaves after 15 min.
- If the physio uses a Google Workspace account whose admin blocks external or anonymous participants,
  or the meeting access is set to "Trusted/Restricted", the bot is **rejected outright**
  ("You can't join this video call"). Recall's fix is **signed-in Google Meet bots** (a Google login group set up in the Recall dashboard).

### P6 — Transcript depends on Meet captions
- `recording_config.transcript.provider = meeting_captions`. Meet captions must be available in the
  spoken language. Urdu or mixed Urdu-English consultations will give empty or poor transcripts, which ends as
  `done_no_transcript`.
- Better option: a Recall-hosted ASR provider (`recallai_streaming`, with language auto-detect), or
  AssemblyAI/Deepgram via Recall.

### P7 — The webhook is the only path to the transcript
- If a webhook is missed (wrong region, wrong secret, Render restart during processing, dashboard
  subscription missing `bot.done` / `transcript.done`), the transcript is never fetched. There is no polling backup.
- `processTranscript` sets `recallStatus='processing'` and then sleeps up to 90 s. A restart in that window
  leaves the session **stuck in `processing` forever**, because the claim excludes `processing`.
- `RECALL_WEBHOOK_BASE_URL` is no longer used anywhere. It is easy to think it configures the webhook, but it does not.

### P8 — Smaller issues
- Bots are not cancelled or rescheduled when a session is cancelled or rebooked, so orphan bots can join wrong calls.
- `recallError` is shown only on the physio session detail page. There are no logs or alerts on the server side.
- `.env.example` is missing `RECALL_REGION` and `APP_TIMEZONE`.

---

## 3. Target flow

```
Booking ─► Meet link created (error stored on session if it fails)
        └► Bot SCHEDULED with Recall (join_at = start − 2 min)     ← primary path

Physio clicks "Start session" in portal  (or patient taps "Open Google Meet")
        └► POST /api/sessions/:id/start ─► ensureBot(session, 'now')  ← "meeting started" trigger
              • no bot / dead bot → create ad-hoc bot (joins immediately)
              • live bot already waiting/recording → no-op
        └► then opens the Meet link

Server scheduler (every 60 s, independent of page loads)
        ├► sessions starting in ≤ 2 min without live bot → ensureBot
        ├► active sessions whose bot died before recording → ensureBot (retry, max N)
        ├► bots in done/fatal state but no transcript → poll Recall + processTranscript
        └► sessions stuck in 'processing' > 10 min → reset & re-run

Recall webhook (bot.* , transcript.done) ─► status updates + processTranscript (unchanged, hardened)
```

The main idea is that **"meeting started" = the physio presses Start/Join in the portal**. Google does not
push a simple "meeting started" event without the Workspace Events API and Pub/Sub, which this POC does not
need. Using the button and the scheduled bot together means the bot is there whether the call starts on time,
early, or late.

---
 
## 4. Implementation plan

### Phase 0 — Diagnose and fix configuration (no code, do first)
1. **Find the key's region:** call `GET https://<region>.recall.ai/api/v1/bot/?page_size=1` with the
   key for each of `us-east-1`, `us-west-2`, `eu-central-1`, `ap-northeast-1`. The one that returns 200 is the region.
   Set `RECALL_REGION` in `.env.local` **and** in Render (and fix the hard-coded value in `render.yaml`).
2. **Webhook:** in *that region's* Recall dashboard, register `https://<render-app>/api/webhook/recall`
   and subscribe to `bot.joining_call`, `bot.in_waiting_room`, `bot.in_call_recording`, `bot.call_ended`,
   `bot.done`, `bot.fatal`, and `transcript.done`. Copy its signing secret (`whsec_…`) into `RECALL_WEBHOOK_SECRET`.
3. **Google OAuth:** move the OAuth consent screen from *Testing* to *In production* (or re-connect
   physios weekly while testing). Confirm with the physio's `googleTokens` that Meet creation works.
4. Check existing sessions in Mongo for `recallStatus` / `recallError`. This confirms which of P1, P2, or P5 is happening.
5. Smoke test: create one ad-hoc bot by hand against a live Meet and admit it. This proves the region,
   key, and Meet access before any code changes.

### Phase 1 — Make failures visible
- `sessionRoutes.js /book`: when Meet creation fails or the physio has no Google tokens, store
  `recallStatus: 'no_meeting_link'` and a clear `recallError` (for example "Physio's Google Calendar is disconnected").
- Log the Recall API response body and status on every create or fetch failure.
- Portal: show a warning badge on the appointments list when a session has a `recallError`.
- Add `RECALL_REGION` and `APP_TIMEZONE` to `.env.example`. Remove or document the unused `RECALL_WEBHOOK_BASE_URL`.

### Phase 2 — `ensureBot` + "Start session" trigger (the core of the requested flow)
- **recallService.js**
  - `createBot({ meetingUrl, sessionId, joinAt | 'now' })`: keep `metadata.sessionId`, and set `join_at` to `start − 2 min`.
  - Add `getBot(botId)` (returns the latest `status_changes` code) and `deleteBot(botId)` (unschedule).
  - Switch the transcript provider to `recallai_streaming` with language detection, behind an env flag
    (`RECALL_TRANSCRIPT_PROVIDER`, default `meeting_captions`, so it can be rolled back).
- **New `server/services/botOrchestrator.js`**
  - `ensureBot(session, { now })`: atomic claim (same pattern as today). Look up the current bot with `getBot`.
    If it is missing or in a terminal state (`done`, `fatal`, `call_ended` before recording), create a new one,
    then save `recallBotId`, increment `recallAttempts`, and update `recallStatus`.
  - Cap retries (for example 3 per session) to avoid bot storms.
- **sessionRoutes.js**
  - `POST /api/sessions/:id/start` (physio or patient of that session only): sets `status='active'`,
    calls `ensureBot(session, { now: true })`, and returns `{ meetingUrl, recallStatus }`.
  - Replace the inline `scheduleRecallBot` and the lazy `maybeActivate` fallback with `ensureBot`.
- **Session model:** add `recallAttempts: Number`, `recallLastCheckedAt: Date`, `processingStartedAt: Date`.
- **Portal** `sessions/[id]/page.jsx`: change "Join Google Meet" into a **"Start session"** button. It calls
  `/start` first, then opens `meetingUrl` in a new tab. Keep the "Admit the Active Mentor Scribe" notice, and
  poll the session every 10 s while it is active so scribe status updates live (or emit over the existing socket.io).
- **Mobile** `MeetingScreen.tsx`: call `/start` before `Linking.openURL(meetingUrl)`. This way the bot is
  sent even if the patient joins first.

### Phase 3 — Background scheduler (does not depend on page loads)
- New `server/services/recallScheduler.js`, started from `server.js` after Mongo connects (`setInterval`, 60 s),
  with a guard so only one tick runs at a time:
  1. Sessions with `scheduledStart` within the next 2 min (or started under 30 min ago), a `meetingUrl`, and
     no live bot → `ensureBot`.
  2. Sessions whose bot is in a terminal state with no transcript → poll `getBot`. If recording happened, run
     `processTranscript`. Otherwise retry `ensureBot` while still within the session window.
  3. `recallStatus='processing'` with `processingStartedAt` older than 10 min → reset and re-run (fixes the stuck state in P7).
  4. Move the `missed` and `active` status transitions here too, so the GET handlers become read-only.
- Render keeps the instance awake through the existing self-ping in `server.js`, so an in-process interval
  is enough for the POC. If this grows, move it to a Render Cron Job or a job queue.

### Phase 4 — Harden the webhook and transcript pipeline
- `webhookRoutes.js`: export `processTranscript` so the scheduler can reuse it. Set `processingStartedAt` on claim.
- Treat `bot.call_ended` with sub-codes `timeout_exceeded_waiting_room`, `timeout_exceeded_noone_joined`, and
  `bot_kicked_from_waiting_room` as **retryable**. Mark `recallStatus='needs_retry'` so the scheduler or the
  next `/start` sends a new bot.
- Handle `bot.recording_permission_allowed` and `bot.in_call_recording` so the portal can show "Recording".

### Phase 5 — Lifecycle and Meet access
- On cancel or reschedule: `deleteBot` for scheduled bots, then re-run `ensureBot` with the new time.
- Optional, recommended if any physio uses Google Workspace: set up **Recall signed-in Google Meet bots**
  (Google login group in the Recall dashboard) and pass `google_meet: { login_required: true }` (as Recall documents it)
  so the bot can join restricted meetings and is admitted more reliably.
- Optional: name the bot `"Active Mentor Scribe (recording)"` so physios recognise it in the lobby.

---

## 5. Test plan
| # | Scenario | Expected |
|---|---|---|
| 1 | Book a slot ≥ 15 min ahead, physio joins on time and admits the bot | Bot in lobby ≈ 2 min before start → recording → transcript and summary on the session page |
| 2 | Book < 10 min ahead | Ad-hoc bot joins immediately |
| 3 | Physio starts the session 25 min late with "Start session" | First bot timed out → `/start` sends a new bot → transcript saved |
| 4 | Physio never admits the bot | `recallError` = not admitted; scheduler retries up to the cap |
| 5 | Patient opens Meet first from the app | `/start` from mobile ensures the bot |
| 6 | Webhook endpoint disabled | Scheduler polling still saves the transcript |
| 7 | Kill the server during `processing` | After restart, stuck session is reset and transcribed |
| 8 | Physio's Google disconnected | Booking shows "no meeting link" error; no silent failure |
| 9 | Urdu or mixed-language consult (with `recallai_streaming`) | Non-empty transcript |
| 10 | Cancel a booked session | Scheduled bot deleted in Recall |

---

## 6. Order of work
1. **Phase 0** (config). This alone is likely to make the bot appear (P1, P2).
2. Phase 1 + Phase 2 (visible errors + Start-session trigger): delivers "bot joins when the meeting starts".
3. Phase 3 + Phase 4 (scheduler + hardening): makes it reliable without anyone watching.
4. Phase 5 (lifecycle, signed-in bots), as needed.
