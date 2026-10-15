'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Nav from '../../../components/Nav';
import { api, getToken } from '../../../lib/api';

function fmt(n, decimals = 0) {
  return n != null ? Number(n).toFixed(decimals) : '—';
}

function StatBox({ label, value, sub }) {
  return (
    <div className="rounded-lg bg-white/5 p-4 text-center">
      <p className="text-2xl font-bold text-[#EC9F05]">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      <p className="text-xs text-white/40 mt-1">{label}</p>
    </div>
  );
}

export default function ResultsPage() {
  const { id } = useParams();
  const router = useRouter();
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { router.push('/login'); return; }
    api.get(`/api/results/prescription/${id}`)
      .then((d) => setResults(d.results || d || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1 p-6 max-w-3xl mx-auto w-full">
        <button onClick={() => router.back()} className="text-xs text-white/40 hover:text-white mb-3 inline-block">← Back</button>
        <h2 className="text-xl font-semibold mb-6">Exercise Results</h2>

        {loading && <p className="text-white/50">Loading…</p>}
        {error && <p className="text-red-400">{error}</p>}
        {!loading && results.length === 0 && (
          <p className="text-white/40">No results yet — patient hasn't completed the exercise.</p>
        )}

        <div className="space-y-6">
          {results.map((r) => {
            const a = r.analysis || {};
            return (
              <div key={r._id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white/50">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  <span className="text-sm font-medium text-[#DA7235]">
                    {r.patientId?.name || 'Patient'}
                  </span>
                </div>

                {/* AI summary */}
                {a.aiSummary && (
                  <div className="rounded-lg border border-[#EC9F05]/30 bg-[#EC9F05]/5 p-4">
                    <p className="text-xs text-[#EC9F05] font-semibold mb-1 uppercase tracking-wide">Clinical Note</p>
                    <p className="text-sm text-white/80 leading-relaxed">{a.aiSummary}</p>
                  </div>
                )}

                {/* Computed metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <StatBox label="Reps" value={`${r.reps}${r.score != null ? ` (${r.score}%)` : ''}`} />
                  <StatBox
                    label="Avg ROM"
                    value={a.romPercent != null ? `${fmt(a.romPercent)}%` : '—'}
                    sub="of target angle"
                  />
                  <StatBox
                    label="Consistency"
                    value={a.consistency != null ? `±${fmt(a.consistency)}°` : '—'}
                    sub="stddev of peaks"
                  />
                  <StatBox
                    label="Assisted"
                    value={`${r.assistedReps ?? 0}`}
                    sub={a.assistedPercent != null ? `${fmt(a.assistedPercent)}% of reps` : undefined}
                  />
                  <StatBox
                    label="Rest Angle"
                    value={r.restAngle != null ? `${Math.round(r.restAngle)}°` : '—'}
                    sub={r.restCalibrated ? 'calibrated' : 'default'}
                  />
                  {r.adaptedTargetAngle != null && (
                    <StatBox
                      label="Adapted Target"
                      value={`${Math.round(r.adaptedTargetAngle)}°`}
                      sub={r.originalTargetAngle != null ? `orig ${Math.round(r.originalTargetAngle)}°` : undefined}
                    />
                  )}
                </div>

                {/* Rep-by-rep peaks */}
                {r.repPeakAngles?.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Rep-by-rep peak angles</p>
                    <div className="flex flex-wrap gap-2">
                      {r.repPeakAngles.map((angle, i) => (
                        <span key={i} className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/70">
                          Rep {i + 1}: {Math.round(angle)}°
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Session recording */}
                {r.videoUrl && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Session recording</p>
                    <video
                      src={r.videoUrl}
                      controls
                      playsInline
                      className="w-full rounded-lg max-h-96 bg-black"
                    />
                  </div>
                )}

                {/* Adaptation events */}
                {r.adaptationEvents?.length > 0 && (
                  <div>
                    <p className="text-xs text-white/40 mb-2">Adaptation events</p>
                    <div className="space-y-1">
                      {r.adaptationEvents.map((ev, i) => (
                        <p key={i} className="text-xs text-white/50">
                          {Math.round(ev.from)}° → {Math.round(ev.to)}° — {ev.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
