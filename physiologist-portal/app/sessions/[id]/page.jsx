'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '../../../components/ui/AppShell';
import PageHeader from '../../../components/ui/PageHeader';
import StatusPill from '../../../components/ui/StatusPill';
import Avatar from '../../../components/ui/Avatar';
import ErrorState from '../../../components/ui/ErrorState';
import PlusPattern from '../../../components/ui/PlusPattern';
import EcgLine from '../../../components/ui/EcgLine';
import { ListSkeleton } from '../../../components/ui/Skeletons';
import {
  AlertIcon, CheckIcon, ChevronLeftIcon, ChevronRightIcon, MessageIcon, PulseIcon, UserIcon, CalendarIcon,
} from '../../../components/ui/Icons';
import { api, getToken } from '../../../lib/api';

const SOAP_LABELS = [
  { key: 'S', label: 'Subjective', hint: 'Patient-reported symptoms, pain level, history…' },
  { key: 'O', label: 'Objective', hint: 'ROM measurements, strength tests, observations…' },
  { key: 'A', label: 'Assessment', hint: 'Clinical impression, diagnosis, contributing factors…' },
  { key: 'P', label: 'Plan', hint: 'Treatment plan, home program, follow-up timing…' },
];

const EXERCISES = [
  { id: 'hand_raise', label: 'Hand Raise', sub: 'Shoulder & elbow rehab' },
];

const SIDES = [
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'both', label: 'Both' },
];

function parseSoap(raw) {
  if (!raw) return { S: '', O: '', A: '', P: '' };
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && ('S' in parsed || 'O' in parsed)) return parsed;
  } catch {}
  return { S: raw, O: '', A: '', P: '' };
}

const FOLLOWUP_OPTIONS = [
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
  { label: '1 month', days: 30 },
];

// Sadaan Attempt — human-readable Recall bot states (server: session.recallStatus)
const SCRIBE_STATUS_LABEL = {
  creating: 'Setting up…',
  scheduled: 'Scheduled to join at session start',
  joining: 'Joining now',
  create_failed: 'Setup failed — will retry automatically',
  needs_retry: 'Bot left the call — sending a new one…',
  no_meeting_link: 'No Meet link, so no scribe bot',
  retry_processing: 'Generating transcript & summary…',
  'bot.joining_call': 'Joining the call',
  'bot.in_waiting_room': 'Waiting to be admitted',
  'bot.in_call_not_recording': 'In call (not recording yet)',
  'bot.in_call_recording': 'Recording',
  'bot.call_ended': 'Call ended — generating transcript…',
  'bot.recording_done': 'Call ended — generating transcript…',
  'bot.done': 'Call ended — generating transcript…',
  processing: 'Generating transcript & summary…',
  transcribed: 'Transcript ready',
  done_no_transcript: 'Finished without a transcript',
  failed: 'Failed',
};

// Map a scribe state onto the portal's status-pill palette.
const SCRIBE_TONE = {
  'bot.in_call_recording': 'approved',
  transcribed: 'approved',
  creating: 'pending',
  scheduled: 'pending',
  joining: 'pending',
  'bot.joining_call': 'pending',
  'bot.in_waiting_room': 'pending',
  'bot.in_call_not_recording': 'pending',
  processing: 'summarised',
  retry_processing: 'summarised',
  'bot.call_ended': 'summarised',
  'bot.recording_done': 'summarised',
  'bot.done': 'summarised',
  create_failed: 'missed',
  needs_retry: 'missed',
  no_meeting_link: 'missed',
  done_no_transcript: 'missed',
  failed: 'missed',
};

function formatLongDate(slotDate) {
  if (!slotDate) return '';
  const d = new Date(`${slotDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return slotDate;
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// "Speaker: words" lines → [{ speaker, text }]
function parseTranscript(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      const i = line.indexOf(': ');
      return i > 0 ? { speaker: line.slice(0, i), text: line.slice(i + 2) } : { speaker: '', text: line };
    });
}

function SectionTitle({ icon, title, aside }) {
  return (
    <div className="card-head" style={{ alignItems: 'center' }}>
      <div className="flex items-center gap-2.5">
        {icon && <span className="icon-tile" style={{ width: 32, height: 32 }}>{icon}</span>}
        <h2 className="card-title">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

export default function SessionPage() {
  const { id } = useParams();
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [soap, setSoap] = useState({ S: '', O: '', A: '', P: '' });
  const [targetReps, setTargetReps] = useState(10);
  const [notes, setNotes] = useState('');
  const [selectedExercise, setSelectedExercise] = useState('hand_raise');
  const [targetSide, setTargetSide] = useState('both'); // left | right | both
  const [patientHistory, setPatientHistory] = useState([]);
  const [followUpDate, setFollowUpDate] = useState('');
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prescribing, setPrescribing] = useState(false);
  const [prescriptionId, setPrescriptionId] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);

  // Sadaan Attempt — "meeting started" trigger: opens Meet immediately (so the popup isn't
  // blocked) and asks the server to send the scribe bot into the call right now.
  function startSession() {
    if (!session?.meetingUrl) return;
    window.open(session.meetingUrl, '_blank', 'noopener,noreferrer');
    setStarting(true);
    api.post(`/api/sessions/${id}/start`, {})
      .then(r => {
        if (r.started === false) setError('Scribe bot was not started: this session is outside its time window.');
        return r;
      })
      .then(r => setSession(prev => prev && ({
        ...prev,
        status: prev.status === 'pending' ? 'active' : prev.status,
        recallStatus: r.recallStatus ?? prev.recallStatus,
        recallError: r.recallError ?? prev.recallError,
      })))
      .catch(e => setError(e.message))
      .finally(() => setStarting(false));
  }

  // End the consultation: the scribe leaves the meeting and the transcript + summary are generated.
  async function endSession() {
    if (!window.confirm('End this session? The scribe will leave the meeting and the transcript will be generated.')) return;
    setEnding(true); setError(''); setSuccess('');
    try {
      const r = await api.post(`/api/sessions/${id}/end`, {});
      setSession(prev => prev && ({
        ...prev,
        endedAt: r.endedAt,
        recallStatus: r.recallStatus ?? prev.recallStatus,
        recallError: r.recallError ?? prev.recallError,
      }));
    } catch (e) {
      setError(`Could not end the session: ${e.message}`);
    } finally {
      setEnding(false);
    }
  }

  // Keep the scribe status live while the consultation is running / being processed.
  useEffect(() => {
    if (!session?.meetingUrl || session.transcriptText) return;
    if (!['pending', 'active'].includes(session.status) && session.recallStatus !== 'processing') return;
    const t = setInterval(() => {
      api.get(`/api/sessions/${id}`).then(d => {
        const s = d.session ?? d;
        setSession(prev => prev && ({
          ...prev,
          status: s.status,
          recallStatus: s.recallStatus,
          recallError: s.recallError,
          recallBotId: s.recallBotId,
          endedAt: s.endedAt,
          transcriptText: s.transcriptText,
          aiSummary: s.aiSummary,
        }));
        if (s.aiSummary) setSoap(cur => (cur.S || cur.O || cur.A || cur.P ? cur : parseSoap(s.approvedSummary || s.aiSummary)));
      }).catch(() => {});
    }, session?.endedAt ? 5000 : 10000);
    return () => clearInterval(t);
  }, [id, session?.meetingUrl, session?.status, session?.recallStatus, session?.transcriptText, session?.endedAt]);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get(`/api/sessions/${id}`)
      .then((d) => {
        const s = d.session ?? d;
        setSession(s);
        setSoap(parseSoap(s.approvedSummary || s.aiSummary));
        if (s.followUpDate) setFollowUpDate(s.followUpDate.split('T')[0]);
        const patientId = s.patientId?._id || s.patientId;
        if (patientId) {
          api.get(`/api/physiologist/patient-sessions/${patientId}`)
            .then(h => setPatientHistory(Array.isArray(h) ? h.filter(x => x._id !== id) : []))
            .catch(() => {});
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function approveSummary() {
    setSaving(true); setError(''); setSuccess('');
    try {
      const d = await api.patch(`/api/physiologist/sessions/${id}/approve`, {
        approvedSummary: JSON.stringify(soap),
      });
      setSession(d.session ?? d);
      setSuccess('Summary approved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function saveFollowUp(date) {
    setSavingFollowUp(true);
    try {
      await api.patch(`/api/physiologist/sessions/${id}/followup`, { followUpDate: date });
      setFollowUpDate(date);
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingFollowUp(false);
    }
  }

  async function prescribeExercise() {
    if (!session?.patientId?._id && !session?.patientId) return;
    setPrescribing(true); setError(''); setSuccess('');
    try {
      const patientId = session.patientId._id || session.patientId;
      const exercise = EXERCISES.find((e) => e.id === selectedExercise);
      const prescription = await api.post('/api/prescriptions', {
        sessionId: id,
        patientId,
        exerciseId: selectedExercise,
        exerciseName: exercise?.label || selectedExercise,
        targetReps,
        side: targetSide,
        notes,
      });
      setPrescriptionId(prescription._id);
      setSuccess('Exercise prescribed successfully! Patient will see it in the app.');
    } catch (err) {
      setError(err.message);
    } finally {
      setPrescribing(false);
    }
  }

  // ── Loading / failed load ───────────────────────────────────────────────────
  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Session review" subtitle="Loading session…" />
        <div className="glass-card padded"><ListSkeleton rows={5} /></div>
      </AppShell>
    );
  }

  if (!session) {
    return (
      <AppShell>
        <PageHeader title="Session review">
          <Link href="/appointments" className="btn-ghost"><ChevronLeftIcon size={16} /> Appointments</Link>
        </PageHeader>
        <div className="glass-card padded"><ErrorState title="Could not load this session" message={error} /></div>
      </AppShell>
    );
  }

  const patientName = session.patientId?.name || 'Unknown patient';
  const approved = session.status === 'approved';
  const showEnd = session.recallBotId && !session.endedAt && !session.transcriptText && session.status === 'active';
  const awaitingTranscript = session.meetingUrl && !session.transcriptText;
  const scribeLabel = SCRIBE_STATUS_LABEL[session.recallStatus] || session.recallStatus;
  const transcript = parseTranscript(session.transcriptText);
  const startLabel = starting
    ? 'Starting…'
    : session.endedAt && !session.transcriptText
      ? 'Rejoin & restart scribe'
      : session.status === 'active' ? 'Join Google Meet' : 'Start session';

  return (
    <AppShell>
      <PageHeader
        title="Session review"
        subtitle={`${formatLongDate(session.slotDate)} · ${session.slotTime}`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={session.status} />
          <Link href="/appointments" className="btn-ghost"><ChevronLeftIcon size={16} /> Appointments</Link>
        </div>
      </PageHeader>

      {/* Feedback */}
      {error && (
        <div className="banner rise border border-rose/25 bg-rose-tint text-rose" role="alert">
          <p className="flex items-center gap-2"><AlertIcon size={18} /> {error}</p>
          <button type="button" className="btn-text-danger" onClick={() => setError('')}>Dismiss</button>
        </div>
      )}
      {success && (
        <div className="banner rise border border-sage/25 bg-sage-tint text-sage" role="status">
          <p className="flex items-center gap-2"><CheckIcon size={18} /> {success}</p>
          {prescriptionId && (
            <Link href={`/results/${prescriptionId}`} className="link-copper">View exercise results →</Link>
          )}
        </div>
      )}

      <div className="stack">
        {/* ── Consultation + scribe ─────────────────────────────────────────── */}
        <div className="dash-hero-row">
          <article className="hero-card rise">
            <PlusPattern />
            <div className="hero-glow" aria-hidden="true" />
            <div className="hero-body">
              <p className="hero-kicker">Consultation</p>
              <p className="hero-time">{session.slotTime}</p>
              <p className="hero-date">{formatLongDate(session.slotDate)}</p>
              {/* In the normal flow (not absolutely positioned) so it never runs through text. */}
              <div className="mt-3 h-9 text-[#e07b3c] opacity-70" aria-hidden="true">
                <EcgLine className="h-full w-full" />
              </div>
              <hr className="hero-divider" style={{ marginTop: 6 }} />
              <div className="hero-patient">
                <Avatar name={patientName} />
                <div className="min-w-0">
                  <p className="hero-name">{patientName}</p>
                  {session.complaints && <p className="hero-program">{session.complaints}</p>}
                </div>
              </div>

              {session.meetingUrl ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-copper"
                    onClick={startSession}
                    disabled={starting || ending}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z" /></svg>
                    {startLabel}
                  </button>
                  {showEnd && (
                    <button
                      type="button"
                      onClick={endSession}
                      disabled={ending || starting}
                      className="inline-flex items-center justify-center gap-1.5 rounded-[12px] border border-[#f08a7e]/40 bg-[#b3392f]/25 px-[14px] py-[10px] text-sm font-bold text-[#ffd2cc] transition-colors hover:bg-[#b3392f]/40 disabled:cursor-not-allowed disabled:opacity-45"
                    >
                      {ending ? 'Ending…' : 'End session'}
                    </button>
                  )}
                </div>
              ) : (
                <p className="mt-5 text-sm text-[#bdb8ac]">
                  No Google Meet link for this session. Connect Google Calendar in your profile to create links for new bookings.
                </p>
              )}
            </div>
          </article>

          <section className="glass-card padded rise" style={{ animationDelay: '40ms' }}>
            <SectionTitle
              icon={<PulseIcon size={18} />}
              title="AI scribe"
              aside={session.recallStatus ? (
                <StatusPill status={SCRIBE_TONE[session.recallStatus] || 'active'} label={scribeLabel} />
              ) : null}
            />

            {!session.meetingUrl ? (
              <p className="text-sm text-muted">The scribe needs a Google Meet link to join the consultation.</p>
            ) : session.transcriptText ? (
              <p className="text-sm text-muted">
                The consultation was recorded and transcribed. Review the transcript and the AI summary below.
              </p>
            ) : session.endedAt ? (
              <p className="text-sm text-muted">
                Session ended — the scribe has left the meeting.
                {['done_no_transcript', 'failed'].includes(session.recallStatus)
                  ? ''
                  : ' Generating the transcript and summary; this page updates automatically.'}
              </p>
            ) : (
              <ol className="m-0 flex list-none flex-col gap-3 p-0 text-sm">
                {[
                  ['Start the session', 'Opens Google Meet and sends the “Active Mentor Scribe” into the call.'],
                  ['Admit the scribe', 'Click Admit when it asks to join, so the consultation is recorded.'],
                  ['End the session', 'The scribe leaves and the transcript and summary are generated.'],
                ].map(([title, copy], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-copper-tint text-xs font-bold text-copper-strong">
                      {i + 1}
                    </span>
                    <span>
                      <span className="block font-bold text-text">{title}</span>
                      <span className="text-muted">{copy}</span>
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {awaitingTranscript && session.endedAt && !['done_no_transcript', 'failed'].includes(session.recallStatus) && (
              <div className="mt-4 flex flex-col gap-2" aria-hidden="true">
                <div className="glass-sk h-3 w-11/12" />
                <div className="glass-sk h-3 w-3/4" />
                <div className="glass-sk h-3 w-5/6" />
              </div>
            )}

            {session.recallError && (
              <p className="mt-4 flex items-start gap-2 rounded-xl bg-rose-tint px-3 py-2 text-sm font-semibold text-rose" role="alert">
                <AlertIcon size={18} />
                <span>{session.recallError}</span>
              </p>
            )}
          </section>
        </div>

        {/* ── Clinical record + actions ─────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {/* Main column */}
          <div className="stack min-w-0">
            {/* SOAP summary */}
            <section className="glass-card padded rise" style={{ animationDelay: '80ms' }}>
              <SectionTitle
                icon={<CheckIcon size={18} />}
                title="AI-generated summary (SOAP)"
                aside={approved ? <StatusPill status="approved" label="Approved" /> : (
                  session.aiSummary ? <StatusPill status="summarised" label="Needs review" /> : null
                )}
              />
              {!session.aiSummary && !approved && (
                <p className="form-hint" style={{ marginTop: -6, marginBottom: 14 }}>
                  The summary is filled in automatically once the consultation is transcribed. You can also write it yourself.
                </p>
              )}
              <div className="flex flex-col gap-4">
                {SOAP_LABELS.map(({ key, label, hint }) => (
                  <div key={key}>
                    <label className="form-label flex items-center gap-2" htmlFor={`soap-${key}`}>
                      <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-ink text-[11px] font-bold text-white">{key}</span>
                      {label}
                    </label>
                    <textarea
                      id={`soap-${key}`}
                      value={soap[key] || ''}
                      onChange={(e) => setSoap(prev => ({ ...prev, [key]: e.target.value }))}
                      placeholder={hint}
                      rows={3}
                      className="form-area"
                      style={{ minHeight: 96 }}
                    />
                  </div>
                ))}
              </div>
              {!approved && (
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button type="button" className="btn-copper" onClick={approveSummary} disabled={saving}>
                    {saving ? 'Saving…' : 'Approve summary'}
                  </button>
                  <span className="form-hint" style={{ margin: 0 }}>Approving shares the summary with the patient.</span>
                </div>
              )}
            </section>

            {/* Transcript */}
            {session.transcriptText && (
              <section className="glass-card padded rise" style={{ animationDelay: '120ms' }}>
                <SectionTitle
                  icon={<MessageIcon size={18} />}
                  title="Session transcript"
                  aside={<span className="label-muted">{transcript.length} line{transcript.length === 1 ? '' : 's'}</span>}
                />
                <div className="max-h-[420px] overflow-y-auto rounded-[14px] bg-white/45 p-3">
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {transcript.map((line, i) => (
                      <li key={i} className="flex gap-3">
                        <Avatar name={line.speaker || '?'} size="sm" />
                        <div className="min-w-0">
                          {line.speaker && <p className="m-0 text-[13px] font-bold text-text">{line.speaker}</p>}
                          <p className="m-0 text-sm leading-relaxed text-text">{line.text}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            )}
          </div>

          {/* Side column */}
          <div className="stack min-w-0">
            {/* Patient */}
            <section className="glass-card padded rise" style={{ animationDelay: '80ms' }}>
              <SectionTitle icon={<UserIcon size={18} />} title="Patient" />
              <div className="flex items-center gap-3">
                <Avatar name={patientName} />
                <div className="min-w-0">
                  <p className="m-0 font-bold">{patientName}</p>
                  {session.patientId?.email && <p className="m-0 truncate text-[13px] text-muted">{session.patientId.email}</p>}
                </div>
              </div>
              {(session.complaints || session.medicalHistory) && (
                <dl className="meta-rows mt-4">
                  {session.complaints && (
                    <div className="flex flex-col gap-1 border-t border-[var(--hairline)] py-3">
                      <dt className="text-[13px] font-semibold">Complaints</dt>
                      <dd className="text-sm" style={{ fontWeight: 500 }}>{session.complaints}</dd>
                    </div>
                  )}
                  {session.medicalHistory && (
                    <div className="flex flex-col gap-1 border-t border-[var(--hairline)] py-3">
                      <dt className="text-[13px] font-semibold">History</dt>
                      <dd className="text-sm" style={{ fontWeight: 500 }}>{session.medicalHistory}</dd>
                    </div>
                  )}
                </dl>
              )}
            </section>

            {/* Prescribe exercise */}
            <section className="glass-card padded rise" style={{ animationDelay: '120ms' }}>
              <SectionTitle icon={<PulseIcon size={18} />} title="Prescribe exercise" />

              <p className="form-label">Exercise</p>
              <div className="grid gap-2">
                {EXERCISES.map((ex) => {
                  const active = selectedExercise === ex.id;
                  return (
                    <button
                      key={ex.id}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setSelectedExercise(ex.id)}
                      className={`rounded-[14px] border p-3 text-left transition-colors ${
                        active
                          ? 'border-copper bg-copper-soft'
                          : 'border-[var(--hairline)] bg-white/55 hover:bg-white'
                      }`}
                    >
                      <span className="block text-sm font-bold text-text">{ex.label}</span>
                      <span className="block text-[13px] text-muted">{ex.sub}</span>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-[120px_1fr]">
                <div>
                  <label className="form-label" htmlFor="target-reps">Target reps</label>
                  <input
                    id="target-reps"
                    type="number"
                    min={1}
                    max={100}
                    value={targetReps}
                    onChange={(e) => setTargetReps(Number(e.target.value))}
                    className="form-field"
                  />
                </div>
                <div>
                  <p className="form-label">Side</p>
                  <div className="chip-row" role="group" aria-label="Side">
                    {SIDES.map(opt => (
                      <button
                        key={opt.id}
                        type="button"
                        className="chip-pick"
                        aria-pressed={targetSide === opt.id}
                        onClick={() => setTargetSide(opt.id)}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <p className="form-hint">The patient cannot change this.</p>
                </div>
              </div>

              <div className="mt-4">
                <label className="form-label" htmlFor="rx-notes">Notes for patient</label>
                <textarea
                  id="rx-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="e.g. Only raise to elbow height. Stop if pain exceeds 3/10."
                  className="form-area"
                  style={{ minHeight: 88 }}
                />
              </div>

              <button
                type="button"
                className="btn-copper mt-4 w-full"
                onClick={prescribeExercise}
                disabled={prescribing || !approved}
                title={!approved ? 'Approve summary first' : undefined}
              >
                {prescribing ? 'Prescribing…' : 'Prescribe exercise'}
              </button>
              {!approved && <p className="form-hint">Approve the summary before prescribing.</p>}
            </section>

            {/* Follow-up */}
            <section className="glass-card padded rise" style={{ animationDelay: '160ms' }}>
              <SectionTitle icon={<CalendarIcon size={18} />} title="Recommend follow-up" />
              <div className="chip-row">
                {FOLLOWUP_OPTIONS.map(({ label, days }) => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  const dateStr = d.toISOString().split('T')[0];
                  const active = followUpDate === dateStr;
                  return (
                    <button
                      key={days}
                      type="button"
                      className="chip-pick"
                      aria-pressed={active}
                      onClick={() => saveFollowUp(active ? '' : dateStr)}
                      disabled={savingFollowUp}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <label className="form-label mt-4" htmlFor="followup-date">Or pick a date</label>
              <input
                id="followup-date"
                type="date"
                value={followUpDate}
                onChange={e => saveFollowUp(e.target.value)}
                className="form-field"
              />
              {followUpDate && (
                <p className="form-success mt-3">
                  Patient will be notified to book a follow-up by {new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
                </p>
              )}
            </section>

            {/* Previous sessions */}
            {patientHistory.length > 0 && (
              <section className="glass-card padded rise" style={{ animationDelay: '200ms' }}>
                <SectionTitle icon={<CalendarIcon size={18} />} title="Previous sessions" />
                <div className="-mt-2">
                  {patientHistory.map(s => (
                    <Link key={s._id} href={`/sessions/${s._id}`} className="session-row">
                      <div className="min-w-0 flex-1">
                        <p className="m-0 text-sm font-bold tabular-nums">{s.slotDate} at {s.slotTime}</p>
                        {s.complaints && <p className="m-0 truncate text-[13px] text-muted">{s.complaints}</p>}
                      </div>
                      <StatusPill status={s.status} />
                      <ChevronRightIcon size={16} />
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}
