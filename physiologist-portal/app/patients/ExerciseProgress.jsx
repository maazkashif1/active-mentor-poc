'use client';
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatusPill from '../../components/ui/StatusPill';
import { ListSkeleton } from '../../components/ui/Skeletons';
import { ChevronRightIcon, PulseIcon } from '../../components/ui/Icons';
import { api } from '../../lib/api';

const SERIES = 'var(--copper)';

const titleCase = s => String(s || '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
const exerciseName = p => p?.exerciseName?.trim() || titleCase(p?.exerciseId) || 'Exercise';
const fmtDate = d => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const fmtDateTime = d => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
const pct = v => (v == null ? '—' : `${Math.round(v)}%`);
const deg = v => (v == null ? '—' : `${Math.round(v)}°`);
const sideLabel = s => (s === 'left' ? 'Left side' : s === 'right' ? 'Right side' : 'Both sides');

function Kpi({ label, value, sub }) {
  return (
    <div className="rounded-[14px] bg-white/45 px-3 py-3">
      <p className="m-0 text-[13px] font-semibold text-muted">{label}</p>
      <p className="m-0 mt-1 text-[24px] font-extrabold leading-none tracking-tight tabular-nums text-text">{value}</p>
      {sub && <p className="m-0 mt-1 text-[12px] text-muted">{sub}</p>}
    </div>
  );
}

// ROM % per attempt (oldest → newest). One series: copper line, 2px stroke, 8px markers,
// dashed 100% target line, crosshair + tooltip on hover/keyboard. The attempts table
// below is the table view, so every value is reachable without hovering.
function RomTrend({ results }) {
  const points = [...results]
    .reverse()
    .filter(r => r.analysis?.romPercent != null)
    .map(r => ({ date: r.createdAt, value: r.analysis.romPercent, reps: r.reps, score: r.score }));
  const [active, setActive] = useState(null);
  if (points.length < 2) return null;

  const W = 640, H = 170, PAD = { l: 36, r: 46, t: 14, b: 26 };
  const maxY = Math.max(100, ...points.map(p => p.value)) * 1.08;
  const x = i => PAD.l + (i * (W - PAD.l - PAD.r)) / (points.length - 1);
  const y = v => PAD.t + (1 - v / maxY) * (H - PAD.t - PAD.b);
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  const last = points[points.length - 1];
  const a = active != null ? points[active] : null;

  const pick = (e) => {
    const box = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - box.left) / box.width) * W;
    const i = Math.round(((px - PAD.l) / (W - PAD.l - PAD.r)) * (points.length - 1));
    setActive(Math.max(0, Math.min(points.length - 1, i)));
  };
  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); setActive(i => Math.min(points.length - 1, (i ?? -1) + 1)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); setActive(i => Math.max(0, (i ?? points.length) - 1)); }
    if (e.key === 'Escape') setActive(null);
  };

  return (
    <figure className="m-0 mt-4">
      <figcaption className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-[13px] font-semibold text-text">Range of motion per attempt</span>
        <span className="text-[12px] text-muted">% of target angle</span>
      </figcaption>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full touch-none outline-none"
          role="img"
          aria-label={`Range of motion over ${points.length} attempts, latest ${Math.round(last.value)}% of target. Use arrow keys to read each attempt.`}
          tabIndex={0}
          onPointerMove={pick}
          onPointerLeave={() => setActive(null)}
          onFocus={() => setActive(points.length - 1)}
          onBlur={() => setActive(null)}
          onKeyDown={onKey}
        >
          {[0, 50, 100].map(v => (
            <g key={v}>
              <line x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} stroke="rgba(20,19,15,0.07)" strokeDasharray={v === 100 ? '4 4' : undefined} />
              <text x={PAD.l - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">{v}%</text>
            </g>
          ))}
          <text x={W - PAD.r + 4} y={y(100) + 4} fontSize="11" fill="var(--muted)">Target</text>
          <path d={path} fill="none" stroke={SERIES} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {points.map((p, i) => (
            <circle key={i} cx={x(i)} cy={y(p.value)} r={active === i ? 5.5 : 4} fill={SERIES} stroke="#fff" strokeWidth="2" />
          ))}
          {/* direct label on the latest point */}
          <text x={x(points.length - 1) + 8} y={y(last.value) - 8} fontSize="12" fontWeight="700" fill="var(--text)">
            {Math.round(last.value)}%
          </text>
          <text x={PAD.l} y={H - 6} fontSize="11" fill="var(--muted)">{fmtDate(points[0].date)}</text>
          <text x={W - PAD.r} y={H - 6} fontSize="11" fill="var(--muted)" textAnchor="end">{fmtDate(last.date)}</text>
          {a && (
            <line x1={x(active)} x2={x(active)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(20,19,15,0.25)" strokeWidth="1" />
          )}
        </svg>
        {a && (
          <div
            className="pointer-events-none absolute top-1 rounded-xl border border-[var(--hairline)] bg-white px-3 py-2 text-[12px] shadow-md"
            style={{ left: `${(x(active) / W) * 100}%`, transform: `translateX(${active > points.length / 2 ? '-105%' : '5%'})` }}
            role="status"
          >
            <p className="m-0 text-[15px] font-extrabold tabular-nums text-text">{Math.round(a.value)}%</p>
            <p className="m-0 flex items-center gap-1.5 text-muted">
              <span className="inline-block h-[2px] w-3 rounded" style={{ background: SERIES }} />
              ROM · {a.reps} reps · score {a.score ?? '—'}%
            </p>
            <p className="m-0 text-muted">{fmtDateTime(a.date)}</p>
          </div>
        )}
      </div>
    </figure>
  );
}

// The server converts every recording to H.264 MP4 (plays in all browsers) and signs a
// fresh link per request, so links never go stale while the page is in use for a while.
function AttemptVideo({ r }) {
  const [failed, setFailed] = useState(false);
  const status = r.videoStatus || (r.videoUrl ? 'ready' : 'none');

  if (status === 'none') {
    return <p className="m-0 text-[13px] text-muted">No recording for this attempt.</p>;
  }
  if (status === 'pending' || status === 'processing') {
    return (
      <div className="flex items-center gap-3 rounded-[12px] bg-white/60 px-3 py-3 text-[13px] text-muted" role="status">
        <span className="glass-sk h-8 w-8 shrink-0 rounded-full" aria-hidden="true" />
        Preparing the video so it plays on every device — this usually takes under a minute. Reopen this patient to check again.
      </div>
    );
  }
  if (status === 'failed' || !r.videoUrl || failed) {
    return (
      <div className="rounded-[12px] bg-rose-tint px-3 py-3 text-[13px] text-rose" role="alert">
        This recording could not be prepared for in-browser playback.
        {r.videoOriginalUrl && (
          <> <a className="link-copper" href={r.videoOriginalUrl} target="_blank" rel="noopener noreferrer" download>Download the original file</a>.</>
        )}
      </div>
    );
  }
  return (
    <video
      controls
      playsInline
      preload="metadata"
      className="max-h-80 w-full rounded-[12px] bg-black"
      onError={() => setFailed(true)}
    >
      <source src={r.videoUrl} type="video/mp4" />
      Your browser cannot play this video.
    </video>
  );
}

function AttemptDetails({ r }) {
  const an = r.analysis || {};
  return (
    <div className="flex flex-col gap-3 rounded-[12px] bg-white/55 p-3">
      {an.aiSummary && (
        <div>
          <p className="form-label" style={{ marginBottom: 4 }}>Clinical note (AI)</p>
          <p className="m-0 text-sm leading-relaxed text-text">{an.aiSummary}</p>
        </div>
      )}
      {r.repPeakAngles?.length > 0 && (
        <div>
          <p className="form-label" style={{ marginBottom: 6 }}>Peak angle per rep</p>
          <div className="chip-row">
            {r.repPeakAngles.map((v, i) => (
              <span key={i} className="rounded-full bg-copper-tint px-2.5 py-1 text-[12px] font-semibold text-copper-strong tabular-nums">
                Rep {i + 1}: {Math.round(v)}°
              </span>
            ))}
          </div>
        </div>
      )}
      {r.adaptationEvents?.length > 0 && (
        <div>
          <p className="form-label" style={{ marginBottom: 4 }}>Target adaptations</p>
          <ul className="m-0 list-disc pl-5 text-[13px] text-text">
            {r.adaptationEvents.map((ev, i) => (
              <li key={i}>{Math.round(ev.from)}° → {Math.round(ev.to)}° — {ev.reason}</li>
            ))}
          </ul>
        </div>
      )}
      <div>
        <p className="form-label" style={{ marginBottom: 6 }}>Recording</p>
        <AttemptVideo r={r} />
      </div>
    </div>
  );
}

function PlanCard({ item }) {
  const { prescription: p, current, stats, results } = item;
  const [open, setOpen] = useState(null);
  const session = p.sessionId;
  const [all, setAll] = useState(false);
  const rows = all ? results : results.slice(0, 5);

  return (
    <div className="edu-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[15px] font-bold text-text">{exerciseName(p)}</p>
          <p className="m-0 text-[13px] text-muted">
            {p.targetReps} reps · {sideLabel(p.side)}
            {p.raiseAngleThreshold != null ? ` · raise ${deg(p.raiseAngleThreshold)}` : ''}
            {p.currentAdaptedAngle != null ? ` · adapted ${deg(p.currentAdaptedAngle)}` : ''}
          </p>
          {p.notes && <p className="m-0 mt-1 text-[13px] italic text-muted">“{p.notes}”</p>}
        </div>
        <div className="flex items-center gap-2">
          <StatusPill status={current ? 'approved' : 'active'} label={current ? 'Current plan' : 'Earlier version'} />
          {session?._id && (
            <Link href={`/sessions/${session._id}`} className="link-copper whitespace-nowrap">
              {session.slotDate} →
            </Link>
          )}
        </div>
      </div>

      {stats.attempts === 0 ? (
        <p className="m-0 mt-3 text-sm text-muted">Prescribed {fmtDate(p.createdAt)} — the patient hasn&apos;t done this exercise yet.</p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Kpi label="Attempts" value={stats.attempts} sub={`last ${fmtDate(stats.lastAttemptAt)}`} />
            <Kpi label="Avg score" value={pct(stats.avgScore)} sub={`best ${pct(stats.bestScore)}`} />
            <Kpi label="Avg ROM" value={pct(stats.avgROM)} sub={`best ${pct(stats.bestROM)}`} />
            <Kpi label="Consistency" value={stats.avgConsistency == null ? '—' : `±${stats.avgConsistency}°`} sub="peak spread" />
            <Kpi label="Assisted" value={pct(stats.assistedPercent)} sub={`${stats.totalReps} reps total`} />
          </div>

          <RomTrend results={results} />

          <div className="table-scroll mt-4">
            <table className="data-table" style={{ minWidth: 620 }}>
              <caption className="sr-only">Exercise attempts for {exerciseName(p)}</caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Reps</th>
                  <th scope="col">Score</th>
                  <th scope="col">ROM</th>
                  <th scope="col">Consistency</th>
                  <th scope="col">Rest angle</th>
                  <th scope="col">Target</th>
                  <th scope="col"><span className="sr-only">Details</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const an = r.analysis || {};
                  const isOpen = open === r._id;
                  return (
                    <Fragment key={r._id}>
                      <tr>
                        <td className="whitespace-nowrap">{fmtDateTime(r.createdAt)}</td>
                        <td className="tabular-nums">
                          {r.reps}{p.targetReps ? ` / ${p.targetReps}` : ''}
                          {r.assistedReps ? <span className="text-[12px] text-muted"> · {r.assistedReps} assisted</span> : null}
                        </td>
                        <td className="tabular-nums">{pct(r.score)}</td>
                        <td className="tabular-nums">{pct(an.romPercent)}</td>
                        <td className="tabular-nums">{an.consistency == null ? '—' : `±${Math.round(an.consistency)}°`}</td>
                        <td className="tabular-nums">
                          {deg(r.restAngle)}
                          <span className="text-[12px] text-muted">{r.restAngle != null ? (r.restCalibrated ? ' · calibrated' : ' · default') : ''}</span>
                        </td>
                        <td className="tabular-nums">
                          {r.adaptedTargetAngle != null ? `${deg(r.adaptedTargetAngle)}` : deg(r.originalTargetAngle)}
                          {r.adaptedTargetAngle != null && r.originalTargetAngle != null
                            ? <span className="text-[12px] text-muted"> (from {deg(r.originalTargetAngle)})</span> : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-ghost"
                            style={{ padding: '4px 10px' }}
                            aria-expanded={isOpen}
                            onClick={() => setOpen(isOpen ? null : r._id)}
                          >
                            {isOpen ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={8} style={{ paddingTop: 0 }}>
                            <AttemptDetails r={r} />
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          {results.length > 5 && (
            <button type="button" className="btn-dashed" onClick={() => setAll(v => !v)}>
              {all ? 'Show fewer attempts' : `Show all ${results.length} attempts`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

export default function ExerciseProgress({ patientId }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== patientId;

  useEffect(() => {
    let cancelled = false;
    api.get(`/api/physiologist/patients/${patientId}/exercise`)
      .then(d => { if (!cancelled) { setData(d); setError(''); } })
      .catch(e => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoadedFor(patientId); });
    return () => { cancelled = true; };
  }, [patientId]);

  return (
    <section className="mt-6" aria-labelledby="exercise-progress-title">
      <div className="card-head">
        <h3 className="card-title flex items-center gap-2" id="exercise-progress-title">
          <span className="icon-tile" style={{ width: 28, height: 28 }}><PulseIcon size={16} /></span>
          Exercise progress
        </h3>
        {!loading && data?.overall?.lastAttemptAt && (
          <span className="label-muted">Last activity {fmtDate(data.overall.lastAttemptAt)}</span>
        )}
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : error ? (
        <ErrorState message={error} />
      ) : !data?.prescriptions?.length ? (
        <EmptyState icon={<PulseIcon />} title="No exercises prescribed yet">
          Prescribe an exercise from a session to start tracking this patient&apos;s progress.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi label="Attempts" value={data.overall.attempts} sub={`${data.overall.totalReps} reps`} />
            <Kpi label="Avg score" value={pct(data.overall.avgScore)} sub="of target reps" />
            <Kpi label="Avg ROM" value={pct(data.overall.avgROM)} sub="of target angle" />
            <Kpi label="Active days" value={data.overall.activeDays14} sub="in last 14 days" />
          </div>
          {data.prescriptions.map(item => (
            <PlanCard key={item.prescription._id} item={item} />
          ))}
          <p className="list-foot" style={{ margin: 0 }}>
            <ChevronRightIcon size={12} /> Score = reps done ÷ target reps. ROM = peak angle reached ÷ target angle. Consistency = spread of rep peaks (lower is steadier).
          </p>
        </div>
      )}
    </section>
  );
}
