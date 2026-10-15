'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';
import { Suspense } from 'react';
import { SkAppointmentCard } from '../../components/Skeleton';

const TABS = [
  { key: 'all',        label: 'All' },
  { key: 'summarised', label: 'Awaiting Review' },
  { key: 'approved',   label: 'Approved' },
  { key: 'pending',    label: 'Pending' },
];

const STATUS_COLOR = {
  pending:    '#888',
  active:     '#EC9F05',
  summarised: '#5ba4cf',
  approved:   '#22c55e',
  missed:     '#ef4444',
};
const STATUS_LABEL = {
  pending:    'Pending',
  active:     'Active',
  summarised: 'Awaiting Review',
  approved:   'Approved',
  missed:     'Missed',
};

function AppointmentsInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const initStatus   = searchParams.get('status') || 'all';
  const initPatient  = searchParams.get('patient') || '';

  const [sessions,        setSessions]        = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState('');
  const [tab,             setTab]             = useState(initStatus);
  const [search,          setSearch]          = useState('');
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
  }, []);

  const filtered = useMemo(() => {
    let list = sessions;
    if (tab !== 'all') list = list.filter(s => s.status === tab);
    if (initPatient)   list = list.filter(s => String(s.patientId?._id || s.patientId) === initPatient);
    if (search)        list = list.filter(s => (s.patientId?.name || '').toLowerCase().includes(search.toLowerCase()));
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
    <div className="flex flex-col min-h-screen bg-[#111113]">
      <Nav />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Appointments</h1>
            <p className="text-white/40 text-sm mt-1">Full session history</p>
          </div>
          {initPatient && (
            <Link href="/appointments" className="text-xs px-3 py-1.5 rounded-lg bg-white/8 text-white/50 hover:text-white border border-white/10 transition-colors">
              ✕ Clear patient filter
            </Link>
          )}
        </div>

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {!googleConnected && (
          <div className="flex items-center justify-between rounded-xl border border-[#EC9F05]/30 bg-[#EC9F05]/8 px-5 py-3 mb-5 gap-4">
            <p className="text-sm text-[#EC9F05]">
              <span className="font-semibold">Google Calendar not connected</span> — new bookings won&apos;t have a Google Meet link until you connect.
            </p>
            <a href="/profile" className="flex-shrink-0 px-4 py-1.5 rounded-lg bg-[#EC9F05] text-black text-xs font-semibold hover:bg-[#d18e04] transition-colors">
              Connect now
            </a>
          </div>
        )}

        {/* Tabs + search */}
        <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
          <div className="flex gap-1">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === t.key ? 'bg-[#DA7235] text-white' : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                }`}>
                {t.label}
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] tabular-nums ${
                  tab === t.key ? 'bg-black/20 text-white' : 'bg-white/10 text-white/40'
                }`}>
                  {counts[t.key]}
                </span>
              </button>
            ))}
          </div>
          <input
            type="search"
            placeholder="Search by patient name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#DA7235] w-56"
          />
        </div>

        {/* Session cards */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkAppointmentCard key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/8 p-10 text-center">
            <p className="text-white/30 text-sm">No sessions match this filter.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(s => (
              <Link key={s._id} href={`/sessions/${s._id}`}
                className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.03] px-5 py-4 hover:border-[#DA7235]/40 hover:bg-white/[0.05] transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-9 h-9 rounded-full bg-[#DA7235]/15 flex items-center justify-center text-[#DA7235] text-sm font-bold flex-shrink-0">
                    {(s.patientId?.name || 'P')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-white group-hover:text-[#EC9F05] transition-colors">
                      {s.patientId?.name || 'Unknown Patient'}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">
                      {s.slotDate} at {s.slotTime}
                      {s.complaints && <> · <span className="italic">{s.complaints.slice(0, 50)}{s.complaints.length > 50 ? '…' : ''}</span></>}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{
                    background: STATUS_COLOR[s.status] + '20',
                    color: STATUS_COLOR[s.status],
                  }}>
                    {STATUS_LABEL[s.status] || s.status}
                  </span>
                  <span className="text-white/20 group-hover:text-[#DA7235] transition-colors text-sm">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function AppointmentsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#111113]" />}>
      <AppointmentsInner />
    </Suspense>
  );
}
