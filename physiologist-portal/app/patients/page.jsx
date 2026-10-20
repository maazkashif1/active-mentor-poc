'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import SearchInput from '../../components/ui/SearchInput';
import Avatar from '../../components/ui/Avatar';
import StatusPill from '../../components/ui/StatusPill';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { CalendarIcon, ChevronRightIcon, UsersIcon } from '../../components/ui/Icons';
import { ListSkeleton, ProfileSkeleton } from '../../components/ui/Skeletons';
import { api, getToken } from '../../lib/api';
import ExerciseProgress from './ExerciseProgress';

export default function PatientsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get('/api/sessions/physio')
      .then(d => setSessions(Array.isArray(d) ? d : d.sessions || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!expanded || window.innerWidth >= 1040) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.getElementById('patient-profile')?.scrollIntoView({
      behavior: reduce ? 'auto' : 'smooth',
      block: 'start',
    });
  }, [expanded]);

  const patients = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const pid = String(s.patientId?._id || s.patientId);
      if (!map[pid]) {
        map[pid] = {
          _id: pid,
          name: s.patientId?.name || 'Unknown',
          email: s.patientId?.email || '',
          sessions: [],
        };
      }
      map[pid].sessions.push(s);
    });
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [sessions]);

  const filtered = useMemo(() =>
    patients.filter(p => p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.email.toLowerCase().includes(search.toLowerCase())),
  [patients, search]);

  const selected = filtered.find(p => p._id === expanded) || null;

  function onListKeyDown(e) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const buttons = [...e.currentTarget.querySelectorAll('[role="option"]')];
    const index = buttons.indexOf(document.activeElement);
    if (index < 0) return;
    e.preventDefault();
    const next = e.key === 'ArrowDown' ? Math.min(index + 1, buttons.length - 1) : Math.max(index - 1, 0);
    buttons[next]?.focus();
  }

  const subtitle = loading
    ? 'Loading patients'
    : `${patients.length} patient${patients.length === 1 ? '' : 's'}`;

  return (
    <AppShell>
      <PageHeader title="Patients" subtitle={subtitle} />

      <div className="split">
        <GlassCard className="patient-list-card rise">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search patients..."
            label="Search patients"
          />
          {loading ? (
            <ListSkeleton rows={6} />
          ) : error ? (
            <ErrorState message={error} />
          ) : filtered.length === 0 ? (
            <EmptyState icon={<UsersIcon />} title={patients.length === 0 ? 'No patients yet' : 'No patients found'}>
              {patients.length === 0
                ? 'Patients appear here after they book a session with you.'
                : 'Try a different name or email.'}
            </EmptyState>
          ) : (
            <div
              role="listbox"
              aria-label="Patients"
              className="mt-3 flex flex-col gap-1"
              onKeyDown={onListKeyDown}
            >
              {filtered.map(p => {
                const isSelected = expanded === p._id;
                const pending = p.sessions.filter(s => s.status === 'summarised').length;
                return (
                  <button
                    key={p._id}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    className="patient-item"
                    onClick={() => setExpanded(isSelected ? null : p._id)}
                  >
                    <Avatar name={p.name} />
                    <span className="patient-meta">
                      <strong>{p.name}</strong>
                      <span>
                        {p.sessions.length} session{p.sessions.length === 1 ? '' : 's'}
                        {p.email ? ` · ${p.email}` : ''}
                      </span>
                    </span>
                    {pending > 0 && <StatusPill status="summarised" label={`${pending} pending`} />}
                  </button>
                );
              })}
            </div>
          )}
        </GlassCard>

        <GlassCard className="patient-profile-card rise" style={{ animationDelay: '40ms' }} id="patient-profile">
          {loading ? (
            <ProfileSkeleton />
          ) : error ? (
            <ErrorState message={error} />
          ) : !selected ? (
            <EmptyState icon={<UsersIcon />} title="Select a patient">
              Choose someone from the list to see their profile and session history.
            </EmptyState>
          ) : (
            <PatientProfile patient={selected} />
          )}
        </GlassCard>
      </div>
    </AppShell>
  );
}

function PatientProfile({ patient }) {
  const approved = patient.sessions.filter(s => s.status === 'approved').length;
  const latest = patient.sessions[0];
  const historyHref = `/appointments?patient=${patient._id}`;

  return (
    <div>
      <div className="profile-top">
        <div className="profile-id">
          <Avatar name={patient.name} size="lg" />
          <div>
            <h2>{patient.name}</h2>
            <p className="page-sub">Patient profile</p>
            {patient.email ? <p className="session-sub">{patient.email}</p> : null}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link href={`/messages?patient=${patient._id}`} className="btn-ghost">
            Message
            <ChevronRightIcon size={16} />
          </Link>
          <Link href={historyHref} className="btn-ghost">
            All appointments
            <ChevronRightIcon size={16} />
          </Link>
        </div>
      </div>

      <div className="stat-band">
        <div>
          <strong className="tabular-nums">{patient.sessions.length}</strong>
          <span className="label-muted">Sessions</span>
        </div>
        <div>
          <strong className="sage tabular-nums">{approved}</strong>
          <span className="label-muted">Completed</span>
        </div>
        <div>
          <strong className="tabular-nums" style={{ fontSize: 18 }}>{latest?.slotDate || '—'}</strong>
          <span className="label-muted">Last visit</span>
        </div>
      </div>

      <ExerciseProgress key={patient._id} patientId={patient._id} />

      <div className="card-head" style={{ marginTop: 24 }}>
        <h3 className="card-title">Session history</h3>
        <Link href={historyHref} className="link-copper">View full history →</Link>
      </div>

      {patient.sessions.length === 0 ? (
        <EmptyState icon={<CalendarIcon />} title="No sessions yet">
          This patient has no sessions on record.
        </EmptyState>
      ) : patient.sessions.slice(0, 5).map(s => (
        <Link key={s._id} href={`/sessions/${s._id}`} className="session-row">
          <span className="icon-tile"><CalendarIcon size={16} /></span>
          <span className="patient-meta">
            <span className="session-title">{s.slotDate} at {s.slotTime}</span>
            {s.complaints ? (
              <span className="session-sub" style={{ fontStyle: 'italic' }}>
                {s.complaints.split('\n')[0].replace(/^\[seeded\]\s*/, '')}
              </span>
            ) : null}
          </span>
          <StatusPill status={s.status} />
        </Link>
      ))}

      {patient.sessions.length > 5 && (
        <Link href={historyHref} className="link-copper" style={{ display: 'inline-block', marginTop: 12 }}>
          + {patient.sessions.length - 5} more sessions
        </Link>
      )}
    </div>
  );
}
