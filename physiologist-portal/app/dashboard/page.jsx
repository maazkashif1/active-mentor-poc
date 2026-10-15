'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';
import { SkStatCard, SkChartBar, SkQueueRow, SkTableRow } from '../../components/Skeleton';

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

function BarChart({ data, labels }) {
  const max = Math.max(...data, 1);
  const BAR_W = 24;
  const GAP = 6;
  const H = 64;
  const W = data.length * (BAR_W + GAP) - GAP;
  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="none" style={{ display: 'block' }}>
      {data.map((v, i) => {
        const barH = Math.max((v / max) * H, v > 0 ? 3 : 0);
        const x = i * (BAR_W + GAP);
        const y = H - barH;
        return (
          <g key={i}>
            <rect x={x} y={0} width={BAR_W} height={H} rx={4} fill="rgba(255,255,255,0.03)" />
            <rect x={x} y={y} width={BAR_W} height={barH} rx={4} fill="#DA7235" opacity={0.85} />
            <text x={x + BAR_W / 2} y={H + 14} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize={9} fontFamily="system-ui">
              {labels[i]}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 flex flex-col gap-1">
      <p className="text-xs text-white/40 uppercase tracking-wider">{label}</p>
      <p className="text-3xl font-bold tabular-nums" style={{ color: accent }}>{value}</p>
      {sub && <p className="text-xs text-white/30">{sub}</p>}
    </div>
  );
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
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
  }, []);

  const pending  = sessions.filter(s => s.status === 'summarised').length;
  const approved = sessions.filter(s => s.status === 'approved').length;
  const patients = new Set(sessions.map(s => String(s.patientId?._id || s.patientId))).size;

  const last7 = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });
  const chartData   = last7.map(date => sessions.filter(s => s.slotDate === date).length);
  const chartLabels = last7.map(d => {
    const day = new Date(d + 'T00:00:00');
    return ['Su','Mo','Tu','We','Th','Fr','Sa'][day.getDay()];
  });

  const pending_sessions = sessions.filter(s => s.status === 'summarised').slice(0, 6);
  const recent_sessions  = sessions.slice(0, 8);

  return (
    <div className="flex flex-col min-h-screen bg-[#111113]">
      <Nav />
      <main className="flex-1 p-6 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/40 text-sm mt-1">Overview of your practice</p>
        </div>

        {error && <p className="text-red-400 mb-4 text-sm">{error}</p>}

        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkStatCard key={i} />)
          ) : (
            <>
              <StatCard label="Total Patients"   value={patients}        accent="#EC9F05" sub="Unique Patients" />
              <StatCard label="Total Sessions"   value={sessions.length} accent="#DA7235" sub="All Time" />
              <StatCard label="Pending Review"   value={pending}         accent="#ef4444" sub="Need Your Attention" />
              <StatCard label="Approved"         value={approved}        accent="#22c55e" sub="Sessions Completed" />
            </>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-6">
          {/* Bar chart */}
          <div className="md:col-span-2 rounded-xl border border-white/8 bg-white/[0.03] p-5">
            <p className="text-xs text-white/40 uppercase tracking-wider mb-4">Sessions · last 7 days</p>
            {loading ? <SkChartBar /> : <BarChart data={chartData} labels={chartLabels} />}
          </div>

          {/* Pending review queue */}
          <div className="md:col-span-3 rounded-xl border border-white/8 bg-white/[0.03] p-5">
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-white/40 uppercase tracking-wider">Awaiting Review</p>
              <Link href="/appointments?status=summarised" className="text-xs text-[#DA7235] hover:underline">
                View all →
              </Link>
            </div>
            {loading
              ? Array.from({ length: 3 }).map((_, i) => <SkQueueRow key={i} />)
              : pending_sessions.length === 0
              ? <p className="text-white/30 text-sm py-4 text-center">All caught up</p>
              : pending_sessions.map(s => (
                  <Link
                    key={s._id}
                    href={`/sessions/${s._id}`}
                    className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0 hover:text-[#EC9F05] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#DA7235]/20 flex items-center justify-center text-[#DA7235] text-xs font-bold">
                        {(s.patientId?.name || 'P')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-[#EC9F05] transition-colors">
                          {s.patientId?.name || 'Patient'}
                        </p>
                        <p className="text-xs text-white/30">{s.slotDate} at {s.slotTime}</p>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-[#5ba4cf]/15 text-[#5ba4cf]">
                      Review
                    </span>
                  </Link>
                ))
            }
          </div>
        </div>

        {/* Patient exercise activity */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/40 uppercase tracking-wider">Patient Exercise Activity</p>
            <span className="text-xs text-white/20">Last 20 completions</span>
          </div>
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => <SkQueueRow key={i} />)
          ) : activity.length === 0 ? (
            <p className="text-white/30 text-sm py-4 text-center">No exercise results yet</p>
          ) : (
            <div className="space-y-0">
              {activity.map((r) => {
                const a = r.analysis || {};
                const name = r.patientId?.name || 'Patient';
                const exercise = r.prescriptionId?.exerciseId?.replace(/_/g, ' ') || 'exercise';
                const score = r.score != null ? `${r.score}%` : null;
                const rom = a.romPercent != null ? `${Math.round(a.romPercent)}% ROM` : null;
                const prescId = r.prescriptionId?._id || r.prescriptionId;
                return (
                  <Link
                    key={r._id}
                    href={`/results/${prescId}`}
                    className="flex items-center justify-between py-3 border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#EC9F05]/15 flex items-center justify-center text-[#EC9F05] text-xs font-bold shrink-0">
                        {name[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white group-hover:text-[#EC9F05] transition-colors">{name}</p>
                        <p className="text-xs text-white/40 capitalize">
                          {exercise} · {r.reps} reps
                          {score ? ` · ${score}` : ''}
                          {rom ? ` · ${rom}` : ''}
                        </p>
                      </div>
                    </div>
                    <span className="text-xs text-white/30 shrink-0 ml-4">{timeAgo(r.createdAt)}</span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent sessions table */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-white/40 uppercase tracking-wider">Recent Sessions</p>
            <Link href="/appointments" className="text-xs text-[#DA7235] hover:underline">View all →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr className="border-b border-white/5">
                  {['Patient', 'Date', 'Time', 'Status', ''].map(h => (
                    <th key={h} className="text-left text-xs text-white/30 py-2 pr-4 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <SkTableRow key={i} />)
                  : recent_sessions.map(s => (
                      <tr key={s._id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition-colors">
                        <td className="py-2.5 pr-4 font-medium">{s.patientId?.name || '—'}</td>
                        <td className="py-2.5 pr-4 text-white/50 tabular-nums">{s.slotDate}</td>
                        <td className="py-2.5 pr-4 text-white/50 tabular-nums">{s.slotTime}</td>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs px-2 py-0.5 rounded-full" style={{
                            background: STATUS_COLOR[s.status] + '20',
                            color: STATUS_COLOR[s.status],
                          }}>
                            {STATUS_LABEL[s.status] || s.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          <Link href={`/sessions/${s._id}`} className="text-xs text-white/30 hover:text-[#DA7235] transition-colors">
                            Open →
                          </Link>
                        </td>
                      </tr>
                    ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
