'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '../../../components/Nav';
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

const STATUS_COLOR = {
  pending: '#888', active: '#EC9F05', summarised: '#5ba4cf', approved: '#22c55e',
};

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

  if (loading) return (
    <div className="flex flex-col min-h-screen"><Nav /><p className="p-6 text-white/50">Loading…</p></div>
  );

  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full space-y-8">
        {/* Header */}
        <div>
          <a href="/appointments" className="text-xs text-white/40 hover:text-white mb-3 inline-block">← Appointments</a>
          <h2 className="text-xl font-semibold">Session Review</h2>
          <p className="text-white/40 text-sm mt-1">
            {session?.slotDate} at {session?.slotTime}
          </p>
        </div>

        {/* Start / End session — controls the scribe bot */}
        {session?.meetingUrl && (
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <button
              type="button"
              onClick={startSession}
              disabled={starting || ending}
              className="flex items-center justify-center gap-2 w-full rounded-xl border border-[#22c55e]/30 bg-[#22c55e]/10 px-5 py-4 text-[#22c55e] font-semibold hover:bg-[#22c55e]/20 transition-colors disabled:opacity-60"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
              {starting
                ? 'Starting…'
                : session.endedAt && !session.transcriptText
                  ? 'Rejoin & restart scribe'
                  : session.status === 'active' ? 'Join Google Meet' : 'Start session'}
            </button>
            {session.recallBotId && !session.endedAt && !session.transcriptText && session.status === 'active' && (
              <button
                type="button"
                onClick={endSession}
                disabled={ending || starting}
                className="flex items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-red-400 font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-60"
              >
                {ending ? 'Ending…' : 'End session'}
              </button>
            )}
          </div>
        )}

        {/* Sadaan Attempt — the Recall bot joins Meet as a guest and must be admitted by the physio */}
        {session?.meetingUrl && !session?.transcriptText && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-1 text-sm">
            {session.endedAt ? (
              <p className="text-white/70">
                Session ended — the scribe has left the meeting.
                {['done_no_transcript', 'failed'].includes(session.recallStatus)
                  ? ''
                  : ' Generating the transcript and summary; this page updates automatically.'}
              </p>
            ) : (
              <p className="text-white/70">
                Pressing <span className="font-medium text-white">Start session</span> sends the <span className="font-medium text-white">&quot;Active Mentor Scribe&quot;</span> bot into the call.
                Please click <span className="font-medium text-white">Admit</span> so the consultation is recorded. When the consultation is over, press <span className="font-medium text-white">End session</span> so the scribe leaves and the transcript is generated.
              </p>
            )}
            {session.recallStatus && (
              <p className="text-white/40 text-xs">Scribe status: {SCRIBE_STATUS_LABEL[session.recallStatus] || session.recallStatus}</p>
            )}
            {session.recallError && (
              <p className="text-red-400 text-xs">{session.recallError}</p>
            )}
          </section>
        )}

        {/* Patient info */}
        {session?.patientId && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Patient</h3>
            <p className="font-medium">{session.patientId.name || 'Unknown'}</p>
            {session.complaints && (
              <div>
                <span className="text-xs text-white/40">Complaints: </span>
                <span className="text-sm">{session.complaints}</span>
              </div>
            )}
            {session.medicalHistory && (
              <div>
                <span className="text-xs text-white/40">History: </span>
                <span className="text-sm">{session.medicalHistory}</span>
              </div>
            )}
          </section>
        )}

        {/* Transcript */}
        {session?.transcriptText && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-2">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Session Transcript</h3>
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{session.transcriptText}</p>
          </section>
        )}

        {/* AI SOAP Summary */}
        <section className="rounded-xl border border-[#EC9F05]/30 bg-[#EC9F05]/5 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-[#EC9F05] uppercase tracking-wider">
              AI-Generated Summary (SOAP)
            </h3>
            {session?.status === 'approved' && (
              <span className="text-green-400 text-sm font-medium">✓ Approved</span>
            )}
          </div>

          <div className="space-y-4">
            {SOAP_LABELS.map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-white/70 uppercase tracking-wider mb-1.5">
                  {label}
                </label>
                <textarea
                  value={soap[key] || ''}
                  onChange={(e) => setSoap(prev => ({ ...prev, [key]: e.target.value }))}
                  placeholder={hint}
                  rows={key === 'S' || key === 'P' ? 3 : 3}
                  className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-3 text-sm text-white leading-relaxed resize-none focus:outline-none focus:border-[#EC9F05] placeholder:text-white/20"
                />
              </div>
            ))}
          </div>

          {session?.status !== 'approved' && (
            <button
              onClick={approveSummary}
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#EC9F05] text-black font-semibold hover:bg-[#d18e04] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Approve Summary'}
            </button>
          )}
        </section>

        {/* Prescription */}
        <section className="rounded-xl border border-[#DA7235]/30 bg-[#DA7235]/5 p-5 space-y-5">
          <h3 className="text-sm font-medium text-[#DA7235] uppercase tracking-wider">
            Prescribe Exercise
          </h3>

          {/* Exercise selector */}
          <div>
            <label className="text-sm mb-3 block">Select exercise</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {EXERCISES.map((ex) => (
                <button
                  key={ex.id}
                  type="button"
                  onClick={() => setSelectedExercise(ex.id)}
                  className={[
                    'relative rounded-lg border p-3 text-left transition-colors cursor-pointer',
                    selectedExercise === ex.id
                      ? 'border-[#DA7235] bg-[#DA7235]/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20',
                  ].join(' ')}
                >
                  <p className="text-xs font-medium leading-tight">{ex.label}</p>
                  <p className="text-[10px] text-white/40 mt-0.5 leading-tight">{ex.sub}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm mb-2 block">Target reps</label>
              <input
                type="number" min={1} max={100} value={targetReps}
                onChange={(e) => setTargetReps(Number(e.target.value))}
                className="w-28 rounded-lg bg-white/10 border border-white/10 px-4 py-2 text-white focus:outline-none focus:border-[#DA7235]"
              />
            </div>

            <div>
              <label className="text-sm mb-2 block">Side (patient cannot change this)</label>
              <div className="flex gap-2">
                {[
                  { id: 'left', label: 'Left' },
                  { id: 'right', label: 'Right' },
                  { id: 'both', label: 'Both' },
                ].map(opt => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTargetSide(opt.id)}
                    className={[
                      'px-4 py-2 rounded-lg border text-sm transition-colors',
                      targetSide === opt.id
                        ? 'border-[#DA7235] bg-[#DA7235]/20 text-white'
                        : 'border-white/10 bg-white/5 text-white/60 hover:border-white/25',
                    ].join(' ')}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm mb-2 block">Notes for patient</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Only raise to elbow height. Stop if pain exceeds 3/10."
                className="w-full rounded-lg bg-white/5 border border-white/10 px-4 py-2 text-sm text-white resize-none focus:outline-none focus:border-[#DA7235]"
              />
            </div>

            <button
              onClick={prescribeExercise}
              disabled={prescribing || session?.status !== 'approved'}
              className="px-6 py-2.5 rounded-lg bg-[#DA7235] text-white font-semibold hover:bg-[#c5622a] transition-colors disabled:opacity-40"
              title={session?.status !== 'approved' ? 'Approve summary first' : undefined}
            >
              {prescribing ? 'Prescribing…' : 'Prescribe Exercise'}
            </button>
            {session?.status !== 'approved' && (
              <p className="text-xs text-white/30">Approve the summary above before prescribing.</p>
            )}
          </div>
        </section>

        {/* Follow-up recommendation */}
        <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
          <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">Recommend Follow-Up</h3>
          <div className="flex flex-wrap gap-2">
            {FOLLOWUP_OPTIONS.map(({ label, days }) => {
              const d = new Date();
              d.setDate(d.getDate() + days);
              const dateStr = d.toISOString().split('T')[0];
              const active = followUpDate === dateStr;
              return (
                <button
                  key={days}
                  onClick={() => saveFollowUp(active ? '' : dateStr)}
                  disabled={savingFollowUp}
                  className={[
                    'px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50',
                    active
                      ? 'bg-[#EC9F05] text-black'
                      : 'bg-white/5 border border-white/10 text-white/70 hover:border-white/30',
                  ].join(' ')}
                >
                  {label}
                </button>
              );
            })}
            <input
              type="date"
              value={followUpDate}
              onChange={e => saveFollowUp(e.target.value)}
              className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 focus:outline-none focus:border-[#EC9F05]"
            />
          </div>
          {followUpDate && (
            <p className="text-xs text-[#EC9F05]">
              Patient will be notified to book a follow-up by {new Date(followUpDate + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.
            </p>
          )}
        </section>

        {/* Patient history with this physio */}
        {patientHistory.length > 0 && (
          <section className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h3 className="text-sm font-medium text-white/60 uppercase tracking-wider">
              Previous Sessions · {session?.patientId?.name || 'This Patient'}
            </h3>
            <div className="space-y-0">
              {patientHistory.map(s => (
                <a
                  key={s._id}
                  href={`/sessions/${s._id}`}
                  className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:text-[#DA7235] transition-colors group"
                >
                  <div>
                    <p className="text-sm text-white group-hover:text-[#DA7235] transition-colors">
                      {s.slotDate} at {s.slotTime}
                    </p>
                    {s.complaints && (
                      <p className="text-xs text-white/30 mt-0.5 line-clamp-1">{s.complaints}</p>
                    )}
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0 ml-4"
                    style={{ background: (STATUS_COLOR[s.status] || '#888') + '20', color: STATUS_COLOR[s.status] || '#888' }}
                  >
                    {s.status}
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {error && <p className="text-red-400">{error}</p>}
        {success && (
          <div className="space-y-2">
            <p className="text-green-400">{success}</p>
            {prescriptionId && (
              <a href={`/results/${prescriptionId}`} className="text-sm text-[#DA7235] hover:underline block">
                View exercise results →
              </a>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
