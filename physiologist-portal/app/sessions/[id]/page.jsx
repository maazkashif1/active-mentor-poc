'use client';
import { useEffect, useRef, useState } from 'react';
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

// Inserted by the server between recordings when a session is resumed.
const RESUME_MARKER = '— Session resumed —';

// Scribe states meaning "a bot is in the call or its recording is still being processed".
const IN_PROGRESS_STATUSES = [
  'creating', 'joining', 'bot.joining_call', 'bot.in_waiting_room', 'bot.in_call_not_recording',
  'bot.in_call_recording', 'bot.call_ended', 'bot.recording_done', 'bot.done', 'processing', 'retry_processing',
];

const sameSoap = (a, b) => ['S', 'O', 'A', 'P'].every(k => (a?.[k] || '') === (b?.[k] || ''));

// "Speaker: words" lines → [{ speaker, text }] (resume markers → { divider: true })
function parseTranscript(text) {
  return String(text || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => {
      if (line === RESUME_MARKER) return { divider: true };
      const i = line.indexOf(': ');
      return i > 0 ? { speaker: line.slice(0, i), text: line.slice(i + 2) } : { speaker: '', text: line };
    });
}

// ── Patient intake ────────────────────────────────────────────────────────────
// The app books with a note built from the intake screens (DoctorProfile → CareArea →
// KneeIntake → SafetyCheck), one "Label: value" line per answer, e.g.
//   Pain in my left knee when climbing stairs
//   Area: Knee (Left)
//   Surgery: No
//   Onset: 1–4 weeks
//   Pain: 6/10
//   Safety: No, No, Yes
// These are the questions exactly as the patient saw them in the app.
const SAFETY_QUESTIONS = [
  'Are you currently experiencing fever along with your symptoms?',
  'Does your pain regularly wake you at night or remain severe while resting?',
  'Have you experienced unexplained weight loss?',
];
const SIDE_QUESTION = { Knee: 'Which knee?', Shoulder: 'Which shoulder?', Elbow: 'Which elbow?' };
const DEFAULT_CONCERN = ['Initial assessment', 'Appointment intake'];

function parseIntake(raw) {
  const out = { concern: '', area: '', side: '', answers: [], pain: null, safety: [], other: [] };
  const lines = String(raw || '').split('\n').map(l => l.trim()).filter(Boolean);
  lines.forEach((line, i) => {
    const m = line.match(/^(Area|Surgery|Onset|Pain|Safety):\s*(.*)$/i);
    if (!m) {
      const text = line.replace(/^\[seeded\]\s*/i, '');
      if (i === 0 && !out.concern) out.concern = DEFAULT_CONCERN.includes(text) ? '' : text;
      else out.other.push(text);
      return;
    }
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'area') {
      const am = value.match(/^(.*?)\s*\((.*)\)\s*$/);
      out.area = (am ? am[1] : value).replace(/^—$/, '');
      out.side = am ? am[2] : '';
    } else if (key === 'surgery') {
      const part = (out.area || 'area').toLowerCase();
      out.answers.push({ q: `Have you had surgery on ${part === 'joints' ? 'these joints' : `this ${part}`}?`, a: value });
    } else if (key === 'onset') {
      out.answers.push({ q: 'When did the problem begin?', a: value });
    } else if (key === 'pain') {
      const n = parseInt(value, 10);
      out.pain = Number.isFinite(n) ? n : null;
      out.answers.push({ q: 'How much pain are you feeling right now?', a: value, pain: true });
    } else if (key === 'safety') {
      value.split(',').map(v => v.trim()).filter(Boolean).forEach((a, idx) => {
        out.safety.push({ q: SAFETY_QUESTIONS[idx] || `Safety question ${idx + 1}`, a });
      });
    }
  });
  return out;
}

function PainMeter({ value }) {
  if (value == null) return null;
  const tone = value >= 7 ? 'var(--rose)' : value >= 4 ? 'var(--amber-dot)' : 'var(--sage)';
  return (
    <div className="mt-2 flex items-center gap-2" aria-hidden="true">
      <div className="flex flex-1 gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < value ? tone : 'rgba(20,19,15,0.08)' }} />
        ))}
      </div>
      <span className="text-[12px] font-semibold text-muted">{value >= 7 ? 'Severe' : value >= 4 ? 'Moderate' : 'Mild'}</span>
    </div>
  );
}

function QA({ q, children }) {
  return (
    <div className="border-t border-[var(--hairline)] py-3">
      <p className="m-0 text-[13px] font-semibold text-muted">{q}</p>
      <div className="mt-1 text-sm font-semibold text-text">{children}</div>
    </div>
  );
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
  const [followUpDate, setFollowUpDate] = useState('');   // saved on the server
  const [followUpDraft, setFollowUpDraft] = useState(''); // what the physio has picked
  const [savingFollowUp, setSavingFollowUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [prescribing, setPrescribing] = useState(false);
  const [prescription, setPrescription] = useState(null); // last prescription issued for this session
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [starting, setStarting] = useState(false);
  const [ending, setEnding] = useState(false);
  const [info, setInfo] = useState('');
  const [pendingSummary, setPendingSummary] = useState(null); // regenerated summary the physio hasn't loaded yet
  const lastAiSummary = useRef(null);

  // Sadaan Attempt — "meeting started" trigger: opens Meet immediately (so the popup isn't
  // blocked) and asks the server to send the scribe bot into the call right now.
  // A recorded (not yet approved) session can be resumed: the scribe rejoins and the new
  // part is added to the transcript. Approved sessions only reopen the Meet.
  function startSession() {
    if (!session?.meetingUrl) return;
    const isApproved = session.status === 'approved';
    const isResume = !isApproved && !!session.transcriptText && session.status !== 'active';
    if (isResume && !window.confirm('Resume this session? The scribe will rejoin the meeting and the new part of the conversation will be added to the transcript and summary.')) return;
    window.open(session.meetingUrl, '_blank', 'noopener,noreferrer');
    if (isApproved) {
      setInfo('This session is approved and closed, so the scribe will not join. Book a follow-up for a new consultation.');
      return;
    }
    setStarting(true); setError(''); setInfo('');
    api.post(`/api/sessions/${id}/start`, {})
      .then(r => {
        if (r.started === false) {
          const messages = {
            outside_session_window: 'The scribe was not started: this session is outside its time window.',
            approved: 'This session is approved and closed, so the scribe will not join.',
          };
          setError(messages[r.reason] || 'The scribe was not started.');
        } else if (isResume) {
          setInfo('Session resumed — admit the scribe in Google Meet. Press End session when you are done; the summary will be regenerated from the full conversation.');
        }
        return r;
      })
      .then(r => setSession(prev => prev && ({
        ...prev,
        status: r.started === false ? prev.status : 'active',
        endedAt: r.started === false ? prev.endedAt : null,
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
    if (!session?.meetingUrl) return;
    if (!['pending', 'active'].includes(session.status) && !['processing', 'retry_processing'].includes(session.recallStatus)) return;
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
        // A new AI summary (first one, or regenerated after a resume): load it unless the
        // physio has edited the current one — then offer it instead of overwriting.
        if (s.aiSummary && s.aiSummary !== lastAiSummary.current) {
          const previous = parseSoap(lastAiSummary.current);
          const next = parseSoap(s.aiSummary);
          lastAiSummary.current = s.aiSummary;
          setSoap(cur => {
            const untouched = sameSoap(cur, previous) || !(cur.S || cur.O || cur.A || cur.P);
            if (untouched) return next;
            setPendingSummary(next);
            return cur;
          });
        }
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
        lastAiSummary.current = s.aiSummary || null;
        setSoap(parseSoap(s.approvedSummary || s.aiSummary));
        if (s.followUpDate) {
          const saved = s.followUpDate.split('T')[0];
          setFollowUpDate(saved);
          setFollowUpDraft(saved);
        }
        // Existing prescription → show it, so the button reads "Prescribed" / "Prescribe again".
        api.get(`/api/prescriptions/session/${id}`)
          .then(rx => {
            if (!rx?._id) return;
            setPrescription(rx);
            setSelectedExercise(rx.exerciseId || 'hand_raise');
            setTargetReps(rx.targetReps ?? 10);
            setTargetSide(rx.side || 'both');
            setNotes(rx.notes || '');
          })
          .catch(() => {});
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

  // Saves the picked follow-up date (or clears it) — only when the button is pressed.
  async function saveFollowUp() {
    setSavingFollowUp(true); setError(''); setSuccess('');
    try {
      await api.patch(`/api/physiologist/sessions/${id}/followup`, { followUpDate: followUpDraft });
      setFollowUpDate(followUpDraft);
      setSuccess(followUpDraft ? 'Follow-up recommendation saved.' : 'Follow-up recommendation removed.');
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
      const fields = {
        exerciseId: selectedExercise,
        exerciseName: exercise?.label || selectedExercise,
        targetReps,
        side: targetSide,
        notes,
      };
      // "Prescribe again" updates the existing prescription instead of creating a duplicate.
      const saved = prescription?._id
        ? await api.patch(`/api/prescriptions/${prescription._id}`, fields)
        : await api.post('/api/prescriptions', { sessionId: id, patientId, ...fields });
      setSuccess(prescription?._id
        ? 'Prescription updated. The patient will see the changes in the app.'
        : 'Exercise prescribed successfully! Patient will see it in the app.');
      setPrescription(saved);
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
  const showEnd = session.recallBotId && !session.endedAt && session.status === 'active' && !approved;
  const resumed = !!session.transcriptText && session.status === 'active';
  const inProgress = session.status === 'active' && IN_PROGRESS_STATUSES.includes(session.recallStatus);
  const awaitingTranscript = session.meetingUrl && (!session.transcriptText || resumed);
  const scribeLabel = SCRIBE_STATUS_LABEL[session.recallStatus] || session.recallStatus;
  const transcript = parseTranscript(session.transcriptText);
  const intake = parseIntake(session.complaints);
  const redFlags = intake.safety.filter(x => /^yes$/i.test(x.a));
  const rxChanged = !prescription
    || prescription.exerciseId !== selectedExercise
    || Number(prescription.targetReps) !== Number(targetReps)
    || (prescription.side || 'both') !== targetSide
    || (prescription.notes || '') !== notes;
  const rxLabel = prescribing
    ? (prescription ? 'Updating…' : 'Prescribing…')
    : !prescription ? 'Prescribe exercise' : rxChanged ? 'Prescribe again' : 'Prescribed';
  const followUpChanged = followUpDraft !== followUpDate;
  const followUpLabel = savingFollowUp
    ? 'Saving…'
    : !followUpChanged
      ? (followUpDate ? 'Follow-up saved' : 'Save follow-up')
      : !followUpDraft ? 'Remove follow-up' : followUpDate ? 'Update follow-up' : 'Save follow-up';
  const fmtDate = d => new Date(d + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const startLabel = starting
    ? 'Starting…'
    : approved
      ? 'Open Google Meet'
      : session.transcriptText && session.status !== 'active'
        ? 'Resume session'
        : session.endedAt
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
      {info && (
        <div className="banner banner-copper rise" role="status">
          <p>{info}</p>
          <button type="button" className="link-copper" style={{ border: 0, background: 'none', cursor: 'pointer' }} onClick={() => setInfo('')}>Dismiss</button>
        </div>
      )}
      {success && (
        <div className="banner rise border border-sage/25 bg-sage-tint text-sage" role="status">
          <p className="flex items-center gap-2"><CheckIcon size={18} /> {success}</p>
          {prescription?._id && (
            <Link href={`/results/${prescription._id}`} className="link-copper">View exercise results →</Link>
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
            ) : approved ? (
              <p className="text-sm text-muted">
                The summary is approved and this session is closed — the scribe will not join again.
                For another consultation, book a follow-up.
              </p>
            ) : resumed && !session.endedAt ? (
              <p className="text-sm text-muted">
                Session resumed. Admit the scribe in Google Meet; when you press <strong>End session</strong>, the new part
                is added to the transcript and the summary is regenerated from the full conversation.
              </p>
            ) : resumed ? (
              <p className="text-sm text-muted">
                Session ended — adding the new part to the transcript and regenerating the summary. This page updates automatically.
              </p>
            ) : session.transcriptText ? (
              <p className="text-sm text-muted">
                The consultation was recorded and transcribed. Review the transcript and the AI summary below.
                If the consultation continues, <strong>Resume session</strong> adds to it until you approve the summary.
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
              {pendingSummary && !approved && (
                <div className="banner banner-copper" role="status">
                  <p>The summary was regenerated with the resumed part of the consultation.</p>
                  <div className="flex gap-2">
                    <button type="button" className="btn-copper" onClick={() => { setSoap(pendingSummary); setPendingSummary(null); }}>
                      Load updated summary
                    </button>
                    <button type="button" className="btn-ghost" onClick={() => setPendingSummary(null)}>Keep my edits</button>
                  </div>
                </div>
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
                  <button type="button" className="btn-copper" onClick={approveSummary} disabled={saving || inProgress}>
                    {saving ? 'Saving…' : 'Approve summary'}
                  </button>
                  <span className="form-hint" style={{ margin: 0 }}>
                    {inProgress
                      ? 'End the session and wait for the summary before approving.'
                      : 'Approving shares the summary with the patient and closes the session.'}
                  </span>
                </div>
              )}
            </section>

            {/* Transcript */}
            {session.transcriptText && (
              <section className="glass-card padded rise" style={{ animationDelay: '120ms' }}>
                <SectionTitle
                  icon={<MessageIcon size={18} />}
                  title="Session transcript"
                  aside={<span className="label-muted">{transcript.filter(l => !l.divider).length} line{transcript.filter(l => !l.divider).length === 1 ? '' : 's'}</span>}
                />
                <div className="max-h-[420px] overflow-y-auto rounded-[14px] bg-white/45 p-3">
                  <ul className="m-0 flex list-none flex-col gap-3 p-0">
                    {transcript.map((line, i) => line.divider ? (
                      <li key={i} className="flex items-center gap-3 py-1" aria-label="Session resumed">
                        <span className="h-px flex-1 bg-[var(--hairline)]" />
                        <span className="label-muted">Session resumed</span>
                        <span className="h-px flex-1 bg-[var(--hairline)]" />
                      </li>
                    ) : (
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
            {/* Patient + intake answers (as asked in the app) */}
            <section className="glass-card padded rise" style={{ animationDelay: '80ms' }}>
              <SectionTitle icon={<UserIcon size={18} />} title="Patient intake" />
              <div className="flex items-center gap-3">
                <Avatar name={patientName} />
                <div className="min-w-0">
                  <p className="m-0 font-bold">{patientName}</p>
                  {session.patientId?.email && <p className="m-0 truncate text-[13px] text-muted">{session.patientId.email}</p>}
                </div>
              </div>

              {redFlags.length > 0 && (
                <p className="mt-4 mb-0 flex items-start gap-2 rounded-xl bg-rose-tint px-3 py-2 text-[13px] font-semibold text-rose" role="alert">
                  <AlertIcon size={18} />
                  <span>{redFlags.length} safety red flag{redFlags.length > 1 ? 's' : ''} reported — review before treatment.</span>
                </p>
              )}

              <div className="mt-4">
                <QA q="What brings you in today?">
                  {intake.concern || <span className="font-normal text-muted">No description given</span>}
                </QA>
                {intake.area && (
                  <QA q="Which area needs care?">
                    {intake.area}{intake.side ? ` · ${intake.side}` : ''}
                    {intake.side && SIDE_QUESTION[intake.area] && (
                      <span className="block text-[12px] font-normal text-muted">{SIDE_QUESTION[intake.area]} {intake.side}</span>
                    )}
                  </QA>
                )}
                {intake.answers.map(({ q, a, pain }) => (
                  <QA key={q} q={q}>
                    {a}
                    {pain && <PainMeter value={intake.pain} />}
                  </QA>
                ))}
                {intake.other.map((line, i) => (
                  <QA key={`o${i}`} q="Additional notes">{line}</QA>
                ))}
                {session.medicalHistory && <QA q="Medical history">{session.medicalHistory}</QA>}
              </div>

              {intake.safety.length > 0 && (
                <div className="mt-2 border-t border-[var(--hairline)] pt-3">
                  <p className="form-label" style={{ marginBottom: 8 }}>Safety check</p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {intake.safety.map(({ q, a }) => {
                      const flag = /^yes$/i.test(a);
                      return (
                        <li key={q} className="flex items-start justify-between gap-3">
                          <span className="text-[13px] text-text">{q}</span>
                          <span className={`status-pill shrink-0 ${flag ? 'pill-missed' : 'pill-approved'}`}>
                            <span className="status-dot" aria-hidden="true" />{a}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
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
                disabled={prescribing || !approved || !rxChanged}
                title={!approved ? 'Approve summary first' : undefined}
              >
                {!prescribing && prescription && !rxChanged && <CheckIcon size={18} />}
                {rxLabel}
              </button>
              {!approved ? (
                <p className="form-hint">Approve the summary before prescribing.</p>
              ) : prescription && !rxChanged ? (
                <p className="form-hint">The patient can see this prescription in the app. Change any field to prescribe again.</p>
              ) : prescription ? (
                <p className="form-hint">You have unsaved changes to the prescription.</p>
              ) : null}
            </section>

            {/* Follow-up — choices only change the draft; the button saves */}
            <section className="glass-card padded rise" style={{ animationDelay: '160ms' }}>
              <SectionTitle icon={<CalendarIcon size={18} />} title="Recommend follow-up" />
              <div className="chip-row" role="group" aria-label="Follow-up in">
                {FOLLOWUP_OPTIONS.map(({ label, days }) => {
                  const d = new Date();
                  d.setDate(d.getDate() + days);
                  const dateStr = d.toISOString().split('T')[0];
                  const active = followUpDraft === dateStr;
                  return (
                    <button
                      key={days}
                      type="button"
                      className="chip-pick"
                      aria-pressed={active}
                      onClick={() => setFollowUpDraft(active ? '' : dateStr)}
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
                value={followUpDraft}
                onChange={e => setFollowUpDraft(e.target.value)}
                className="form-field"
              />
              <button
                type="button"
                className="btn-copper mt-4 w-full"
                onClick={saveFollowUp}
                disabled={savingFollowUp || !followUpChanged}
              >
                {!savingFollowUp && !followUpChanged && followUpDate && <CheckIcon size={18} />}
                {followUpLabel}
              </button>
              {followUpChanged ? (
                <p className="form-hint">
                  {followUpDraft ? `Not saved yet — the patient will be asked to book by ${fmtDate(followUpDraft)}.` : 'Not saved yet — this removes the follow-up recommendation.'}
                </p>
              ) : followUpDate ? (
                <p className="form-success mt-3">Patient will be notified to book a follow-up by {fmtDate(followUpDate)}.</p>
              ) : (
                <p className="form-hint">Pick when the patient should come back, then save.</p>
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
