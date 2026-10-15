'use client';
import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';
import { SkPatientRow, SkLine } from '../../components/Skeleton';

const STATUS_COLOR = {
  pending:    '#888',
  active:     '#EC9F05',
  summarised: '#5ba4cf',
  approved:   '#22c55e',
};
const STATUS_LABEL = {
  pending:    'Pending',
  active:     'Active',
  summarised: 'Awaiting Review',
  approved:   'Approved',
};

function initials(name) {
  return (name || 'P').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

export default function PatientsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [search,   setSearch]   = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get('/api/sessions/physio')
      .then(d => setSessions(Array.isArray(d) ? d : d.sessions || []))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  // Build patient map
  const patients = useMemo(() => {
    const map = {};
    sessions.forEach(s => {
      const pid = String(s.patientId?._id || s.patientId);
      if (!map[pid]) {
        map[pid] = {
          _id:      pid,
          name:     s.patientId?.name  || 'Unknown',
          email:    s.patientId?.email || '',
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
    [patients, search]
  );

  return (
    <div className="flex flex-col min-h-screen bg-[#111113]">
      <Nav />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">
        <div className="mb-6 flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Patients</h1>
            <p className="text-white/40 text-sm mt-1">
              {loading
                ? <SkLine w="w-20" h="h-3" />
                : `${patients.length} patient${patients.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <input
            type="search"
            placeholder="Search patients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 px-3 py-1.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-[#DA7235] w-56"
          />
        </div>

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => <SkPatientRow key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-xl border border-white/8 p-10 text-center">
            <p className="text-white/30 text-sm">No patients found.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(p => {
              const latest    = p.sessions[0];
              const approved  = p.sessions.filter(s => s.status === 'approved').length;
              const pending   = p.sessions.filter(s => s.status === 'summarised').length;
              const isOpen    = expanded === p._id;

              return (
                <div key={p._id} className="rounded-xl border border-white/8 bg-white/[0.03] overflow-hidden transition-all">
                  {/* Patient row */}
                  <button
                    onClick={() => setExpanded(isOpen ? null : p._id)}
                    className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.03] transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#DA7235]/20 flex items-center justify-center text-[#DA7235] text-sm font-bold flex-shrink-0">
                        {initials(p.name)}
                      </div>
                      <div>
                        <p className="font-medium text-white">{p.name}</p>
                        <p className="text-xs text-white/35">{p.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-center hidden sm:block">
                        <p className="text-lg font-bold text-white tabular-nums">{p.sessions.length}</p>
                        <p className="text-xs text-white/30">Sessions</p>
                      </div>
                      <div className="text-center hidden sm:block">
                        <p className="text-lg font-bold text-[#22c55e] tabular-nums">{approved}</p>
                        <p className="text-xs text-white/30">Completed</p>
                      </div>
                      {pending > 0 && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-[#5ba4cf]/15 text-[#5ba4cf] font-medium">
                          {pending} pending
                        </span>
                      )}
                      {latest && (
                        <div className="text-right hidden md:block">
                          <p className="text-xs text-white/30">Last visit</p>
                          <p className="text-xs text-white/60 tabular-nums">{latest.slotDate}</p>
                        </div>
                      )}
                      <span className={`text-white/30 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▾</span>
                    </div>
                  </button>

                  {/* Expanded session history */}
                  {isOpen && (
                    <div className="border-t border-white/5 px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-xs text-white/40 uppercase tracking-wider">Session History</p>
                        <Link
                          href={`/appointments?patient=${p._id}`}
                          className="text-xs text-[#DA7235] hover:underline"
                        >
                          View full history →
                        </Link>
                      </div>
                      <div className="space-y-2">
                        {p.sessions.slice(0, 5).map(s => (
                          <Link key={s._id} href={`/sessions/${s._id}`}
                            className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 hover:text-[#EC9F05] transition-colors group"
                          >
                            <div>
                              <p className="text-sm text-white group-hover:text-[#EC9F05] transition-colors">
                                {s.slotDate} at {s.slotTime}
                              </p>
                              {s.complaints && (
                                <p className="text-xs text-white/30 mt-0.5 italic">
                                  {s.complaints.slice(0, 70)}{s.complaints.length > 70 ? '…' : ''}
                                </p>
                              )}
                            </div>
                            <span className="text-xs px-2 py-0.5 rounded-full ml-4 flex-shrink-0" style={{
                              background: STATUS_COLOR[s.status] + '20',
                              color: STATUS_COLOR[s.status],
                            }}>
                              {STATUS_LABEL[s.status] || s.status}
                            </span>
                          </Link>
                        ))}
                        {p.sessions.length > 5 && (
                          <Link href={`/appointments?patient=${p._id}`}
                            className="text-xs text-white/30 hover:text-[#DA7235] transition-colors pt-1 block">
                            + {p.sessions.length - 5} more sessions
                          </Link>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
