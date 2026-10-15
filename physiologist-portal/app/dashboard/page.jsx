'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import StatCard from '../../components/ui/StatCard';
import StatusPill from '../../components/ui/StatusPill';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import EcgLine from '../../components/ui/EcgLine';
import PlusPattern from '../../components/ui/PlusPattern';
import { CalendarIcon, CheckIcon, ClockIcon, PulseIcon, UsersIcon, AlertIcon, ArrowRightIcon } from '../../components/ui/Icons';
import { ListSkeleton, TableSkeleton } from '../../components/ui/Skeletons';
import { api, getToken } from '../../lib/api';

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function localTodayLabel(date) {
  return date.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function sessionStamp(slotDate, slotTime) {
  const time = String(slotTime || '00:00').slice(0, 5);
  return new Date(`${slotDate}T${time}`).getTime();
}

function getNextSession(sessions) {
  const cutoff = Date.now() - 15 * 60 * 1000;
  let best = null;
  let bestT = Infinity;
  sessions.forEach((s) => {
    if (s.status !== 'pending' && s.status !== 'active') return;
    const t = sessionStamp(s.slotDate, s.slotTime);
    if (Number.isNaN(t) || t < cutoff || t >= bestT) return;
    best = s;
    bestT = t;
  });
  return best;
}

function formatSessionDate(slotDate) {
  const d = new Date(`${slotDate}T00:00:00`);
  const today = new Date();
  const same = d.getFullYear() === today.getFullYear()
    && d.getMonth() === today.getMonth()
    && d.getDate() === today.getDate();
  const long = d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
  return same ? `Today · ${long}` : long;
}

function DateChip() {
  const label = localTodayLabel(new Date());
  return (
    <div className="date-chip">
      <CalendarIcon size={16} />
      <span suppressHydrationWarning>{label}</span>
    </div>
  );
}

function WeekBars({ data, labels, todayIndex }) {
  const max = Math.max(...data, 1);
  const summary = labels.map((label, i) => `${label} ${data[i]}`).join(', ');
  return (
    <div className="week-bars" role="img" aria-label={`Sessions over the last 7 days: ${summary}`}>
      {data.map((value, i) => {
        const isToday = i === todayIndex;
        const height = value === 0 ? 0 : Math.max((value / max) * 100, isToday ? 36 : 10);
        return (
          <div className="week-col" key={labels[i]}>
            <div className="week-track">
              {value > 0 && (
                <div className={`week-fill ${isToday ? 'is-today' : ''}`} style={{ height: `${height}%` }}>
                  {isToday && <span className="week-count">{value}</span>}
                </div>
              )}
            </div>
            <span className={`week-label ${isToday ? 'is-today' : ''}`}>{labels[i]}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    Promise.all([
      api.get('/api/sessions/physio').then(d => Array.isArray(d) ? d : d.sessions || []),
      api.get('/api/physiologist/activity').catch(() => []),
    ])
      .then(([s, a]) => { setSessions(s); setActivity(Array.isArray(a) ? a : []); })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const pending = sessions.filter(s => s.status === 'summarised').length;
  const approved = sessions.filter(s => s.status === 'approved').length;
  const patients = new Set(sessions.map(s => String(s.patientId?._id || s.patientId))).size;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const chartData = last7.map(date => sessions.filter(s => s.slotDate === date).length);
  const chartLabels = last7.map(d => {
    const day = new Date(`${d}T00:00:00`);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day.getDay()];
  });
  const weekTotal = chartData.reduce((sum, n) => sum + n, 0);

  const pendingSessions = sessions.filter(s => s.status === 'summarised').slice(0, 6);
  const recentSessions = sessions.slice(0, 8);
  const nextSession = getNextSession(sessions);

  return (
    <AppShell>
      <PageHeader title="Dashboard" subtitle="Overview of your practice">
        <DateChip />
      </PageHeader>

      <div className="stack">
        <div className="dash-hero-row">
          <article className="hero-card rise">
            <PlusPattern />
            <div className="hero-glow" aria-hidden="true" />
            {nextSession ? <EcgLine className="hero-ecg" /> : null}
            <div className="hero-body">
              {loading ? (
                <ListSkeleton rows={3} tone="dark" />
              ) : error ? (
                <ErrorState message={error} tone="dark" />
              ) : nextSession ? (
                <>
                  <p className="hero-kicker">Next session</p>
                  <p className="hero-time">{nextSession.slotTime}</p>
                  <p className="hero-date">{formatSessionDate(nextSession.slotDate)}</p>
                  <hr className="hero-divider" />
                  <div className="hero-patient">
                    <Avatar name={nextSession.patientId?.name || 'Unknown patient'} />
                    <div>
                      <p className="hero-name">{nextSession.patientId?.name || 'Unknown patient'}</p>
                      {nextSession.complaints ? (
                        <p className="hero-program">{nextSession.complaints}</p>
                      ) : null}
                    </div>
                    <StatusPill status={nextSession.status} />
                    <Link href={`/sessions/${nextSession._id}`} className="btn-copper">
                      Open session
                      <ArrowRightIcon size={16} />
                    </Link>
                  </div>
                </>
              ) : (
                <EmptyState tone="dark" icon={<CalendarIcon />} title="No upcoming session">
                  When a patient books, their session will show up here.
                </EmptyState>
              )}
            </div>
          </article>

          <GlassCard padded={false} className="stats-grid rise" style={{ animationDelay: '40ms' }}>
            {loading ? (
              <div className="stat-cell" style={{ gridColumn: '1 / -1' }}><ListSkeleton rows={2} /></div>
            ) : error ? (
              <div className="stat-cell" style={{ gridColumn: '1 / -1' }}><ErrorState message={error} /></div>
            ) : (
              <>
                <StatCard label="Total patients" value={patients} sub="Unique patients" tone="amber" icon={<UsersIcon size={16} />} />
                <StatCard label="Total sessions" value={sessions.length} sub="All time" tone="copper" icon={<CalendarIcon size={16} />} />
                <StatCard label="Pending review" value={pending} sub="Need your attention" tone="rose" icon={<AlertIcon size={16} />} />
                <StatCard label="Approved" value={approved} sub="Sessions completed" tone="sage" icon={<CheckIcon size={16} />} />
              </>
            )}
          </GlassCard>
        </div>

        <div className="dash-row">
          <GlassCard className="rise" style={{ animationDelay: '80ms' }}>
            <div className="card-head">
              <h2 className="card-title">Sessions · last 7 days</h2>
              {!loading && !error && (
                <span className="label-muted">{weekTotal} session{weekTotal === 1 ? '' : 's'}</span>
              )}
            </div>
            {loading ? <ListSkeleton rows={2} /> : error ? <ErrorState message={error} /> : (
              <WeekBars data={chartData} labels={chartLabels} todayIndex={6} />
            )}
          </GlassCard>

          <GlassCard className="rise" style={{ animationDelay: '120ms' }}>
            <div className="card-head">
              <h2 className="card-title">Awaiting review</h2>
              <Link href="/appointments?status=summarised" className="link-copper">View all →</Link>
            </div>
            {loading ? <ListSkeleton rows={3} /> : error ? <ErrorState message={error} /> : pendingSessions.length === 0 ? (
              <EmptyState icon={<CheckIcon />} title="All caught up">
                No sessions are waiting on your review right now.
              </EmptyState>
            ) : pendingSessions.map(s => (
              <Link key={s._id} href={`/sessions/${s._id}`} className="queue-row">
                <span className="cell-person">
                  <Avatar name={s.patientId?.name || 'Patient'} size="sm" />
                  <span>
                    <span className="session-title">{s.patientId?.name || 'Patient'}</span>
                    <span className="session-sub">{s.slotDate} at {s.slotTime}</span>
                  </span>
                </span>
                <StatusPill status="summarised" />
              </Link>
            ))}
          </GlassCard>
        </div>

        <div className="dash-row">
          <GlassCard className="rise" style={{ animationDelay: '160ms' }}>
            <div className="card-head">
              <h2 className="card-title">Recent sessions</h2>
              <Link href="/appointments" className="link-copper">View all →</Link>
            </div>
            {loading ? <TableSkeleton /> : error ? <ErrorState message={error} /> : recentSessions.length === 0 ? (
              <EmptyState icon={<ClockIcon />} title="No sessions yet">
                Sessions you book will appear here.
              </EmptyState>
            ) : (
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      {['Patient', 'Date', 'Time', 'Status'].map(h => <th key={h} scope="col">{h}</th>)}
                      <th scope="col"><span className="sr-only">Open</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentSessions.map(s => (
                      <tr key={s._id}>
                        <td>
                          <span className="cell-person">
                            <Avatar name={s.patientId?.name} size="sm" />
                            {s.patientId?.name || '—'}
                          </span>
                        </td>
                        <td className="tabular-nums">{s.slotDate}</td>
                        <td className="tabular-nums">{s.slotTime}</td>
                        <td><StatusPill status={s.status} /></td>
                        <td>
                          <Link href={`/sessions/${s._id}`} className="link-copper">Open</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

          <GlassCard className="rise" style={{ animationDelay: '200ms' }}>
            <div className="card-head">
              <h2 className="card-title">Patient exercise activity</h2>
              <span className="label-muted">Last 20 completions</span>
            </div>
            {loading ? <ListSkeleton rows={4} /> : error ? <ErrorState message={error} /> : activity.length === 0 ? (
              <EmptyState icon={<PulseIcon />} title="No exercise results yet">
                Completed exercises from your patients will show up here.
              </EmptyState>
            ) : activity.map((r) => {
              const a = r.analysis || {};
              const name = r.patientId?.name || 'Patient';
              const exercise = r.prescriptionId?.exerciseId?.replace(/_/g, ' ') || 'exercise';
              const score = r.score != null ? `${r.score}%` : null;
              const rom = a.romPercent != null ? `${Math.round(a.romPercent)}% ROM` : null;
              const prescId = r.prescriptionId?._id || r.prescriptionId;
              return (
                <Link key={r._id} href={`/results/${prescId}`} className="activity-row">
                  <span className="cell-person">
                    <Avatar name={name} size="sm" />
                    <span>
                      <span className="session-title">{name}</span>
                      <span className="session-sub">
                        <span className="capitalize">{exercise}</span>
                        {` · ${r.reps} reps`}
                        {score ? ` · ${score}` : ''}
                        {rom ? ` · ${rom}` : ''}
                      </span>
                    </span>
                  </span>
                  <span className="label-muted">{timeAgo(r.createdAt)}</span>
                </Link>
              );
            })}
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}
