'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import FilterTabs from '../../components/ui/FilterTabs';
import SearchInput from '../../components/ui/SearchInput';
import StatusPill from '../../components/ui/StatusPill';
import Avatar from '../../components/ui/Avatar';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import { CalendarIcon, ChevronRightIcon } from '../../components/ui/Icons';
import { ListSkeleton } from '../../components/ui/Skeletons';
import { api, getToken } from '../../lib/api';

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'summarised', label: 'Awaiting Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'pending', label: 'Pending' },
];

function AppointmentsInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initStatus = searchParams.get('status') || 'all';
  const initPatient = searchParams.get('patient') || '';

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [tab, setTab] = useState(initStatus);
  const [search, setSearch] = useState('');
  const [googleConnected, setGoogleConnected] = useState(true);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    Promise.all([
      api.get('/api/sessions/physio'),
      api.get('/api/users/profile').catch(() => null),
    ]).then(([d, me]) => {
      setSessions(Array.isArray(d) ? d : d.sessions || []);
      if (me) setGoogleConnected(!!(me.googleTokens?.refreshToken));
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const filtered = useMemo(() => {
    let list = sessions;
    if (tab !== 'all') list = list.filter(s => s.status === tab);
    if (initPatient) list = list.filter(s => String(s.patientId?._id || s.patientId) === initPatient);
    if (search) list = list.filter(s => (s.patientId?.name || '').toLowerCase().includes(search.toLowerCase()));
    return list;
  }, [sessions, tab, search, initPatient]);

  const counts = useMemo(() => {
    const c = {};
    TABS.forEach(t => {
      c[t.key] = t.key === 'all' ? sessions.length : sessions.filter(s => s.status === t.key).length;
    });
    return c;
  }, [sessions]);

  return (
    <AppShell>
      <PageHeader title="Appointments" subtitle="Full session history">
        {initPatient && (
          <Link href="/appointments" className="btn-ghost">Clear patient filter</Link>
        )}
      </PageHeader>

      {!googleConnected && (
        <div className="banner banner-amber" role="status">
          <p>
            <strong>Google Calendar not connected.</strong>
            {' '}New bookings won&apos;t have a Google Meet link until you connect.
          </p>
          <Link href="/profile" className="btn-copper">Connect now</Link>
        </div>
      )}

      <GlassCard className="rise" style={{ animationDelay: '40ms' }}>
        <div className="toolbar">
          <FilterTabs tabs={TABS} value={tab} onChange={setTab} counts={counts} label="Filter sessions" />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by patient name..."
            label="Search by patient name"
          />
        </div>

        {loading ? (
          <ListSkeleton rows={6} />
        ) : error ? (
          <ErrorState message={error} />
        ) : filtered.length === 0 ? (
          <EmptyState icon={<CalendarIcon />} title={sessions.length === 0 ? 'No sessions yet' : 'Nothing matches'}>
            {sessions.length === 0
              ? 'Booked sessions will show up here.'
              : 'No sessions match this filter.'}
          </EmptyState>
        ) : (
          <div className="appt-scroll">
            <div className="appt-scroll-inner" role="table" aria-label="Appointments">
              <div className="appt-head" role="row">
                <span role="columnheader">Patient</span>
                <span role="columnheader">Date and time</span>
                <span role="columnheader">Program</span>
                <span role="columnheader">Status</span>
                <span role="columnheader"><span className="sr-only">Open</span></span>
              </div>
              {filtered.map(s => (
                <Link key={s._id} href={`/sessions/${s._id}`} className="appt-row" role="row">
                  <span className="cell-person" role="cell">
                    <Avatar name={s.patientId?.name || 'Unknown Patient'} size="sm" />
                    {s.patientId?.name || 'Unknown Patient'}
                  </span>
                  <span role="cell" className="tabular-nums">{s.slotDate} at {s.slotTime}</span>
                  <span role="cell" className="program" title={s.complaints || undefined}>
                    {s.complaints || '—'}
                  </span>
                  <span role="cell"><StatusPill status={s.status} /></span>
                  <span role="cell" aria-hidden="true"><ChevronRightIcon size={16} /></span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {!loading && !error && (
          <p className="list-foot">Showing {filtered.length} session{filtered.length === 1 ? '' : 's'}</p>
        )}
      </GlassCard>
    </AppShell>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={(
      <AppShell>
        <PageHeader title="Appointments" subtitle="Full session history" />
        <GlassCard><ListSkeleton rows={6} /></GlassCard>
      </AppShell>
    )}>
      <AppointmentsInner />
    </Suspense>
  );
}
