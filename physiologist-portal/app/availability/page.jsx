'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AppShell from '../../components/ui/AppShell';
import PageHeader from '../../components/ui/PageHeader';
import GlassCard from '../../components/ui/GlassCard';
import EmptyState from '../../components/ui/EmptyState';
import ErrorState from '../../components/ui/ErrorState';
import StatusPill from '../../components/ui/StatusPill';
import { CalendarIcon, ChevronLeftIcon, ChevronRightIcon } from '../../components/ui/Icons';
import { CalendarSkeleton, ProfileSkeleton } from '../../components/ui/Skeletons';
import { api, getToken } from '../../lib/api';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDEX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
const DAY_LETTER = { Mon: 'M', Tue: 'T', Wed: 'W', Thu: 'T', Fri: 'F', Sat: 'S', Sun: 'S' };
const DURATIONS = [15, 20, 30, 45, 60];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function toMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function generateForPeriod({ workDays, startTime, endTime, duration, breakStart, breakEnd }) {
  const slots = [];
  const startM = toMins(startTime);
  const endM = toMins(endTime);
  const brkS = breakStart ? toMins(breakStart) : null;
  const brkE = breakEnd ? toMins(breakEnd) : null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const cur = new Date(today);
  while (cur <= endDate) {
    if (workDays.some(d => DAY_INDEX[d] === cur.getDay())) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}-${String(cur.getDate()).padStart(2, '0')}`;
      let t = startM;
      while (t + duration <= endM) {
        const inBreak = brkS !== null && !(t + duration <= brkS || t >= brkE);
        if (!inBreak) slots.push({ date: dateStr, time: toTimeStr(t) });
        t += duration;
      }
    }
    cur.setDate(cur.getDate() + 1);
  }
  return slots;
}

function slotMap(slots) {
  const map = {};
  slots.forEach(s => {
    if (!map[s.date]) map[s.date] = [];
    map[s.date].push(s);
  });
  return map;
}

function buildGrid(year, month) {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const days = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function isoDate(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function fmtDate(dateStr) {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
}

function AvailabilityInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [workDays, setWorkDays] = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('17:00');
  const [duration, setDuration] = useState(30);
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd, setBreakEnd] = useState('13:00');

  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedDate, setSelectedDate] = useState(() => isoDate(new Date()));

  const todayObj = new Date();
  const todayStr = isoDate(todayObj);
  const [viewYear, setViewYear] = useState(todayObj.getFullYear());
  const [viewMonth, setViewMonth] = useState(todayObj.getMonth());

  useEffect(() => {
    const token = getToken();
    if (!token) { router.push('/login'); return; }
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload.role !== 'physiologist') router.push('/login');
    } catch { router.push('/login'); }

    Promise.all([
      api.get('/api/physiologist/my-slots'),
      api.get('/api/physiologist/schedule').catch(() => null),
    ]).then(([slotsRes, schedRes]) => {
      setSlots(slotsRes.slots || []);
      if (schedRes?.schedule) {
        const s = schedRes.schedule;
        if (s.workDays?.length) setWorkDays(s.workDays);
        if (s.startTime) setStartTime(s.startTime);
        if (s.endTime) setEndTime(s.endTime);
        if (s.breakStart) setBreakStart(s.breakStart);
        if (s.breakEnd) setBreakEnd(s.breakEnd);
        if (s.duration) setDuration(s.duration);
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleApply = async () => {
    setError(''); setSuccess('');
    setApplying(true);
    try {
      const schedule = { workDays, startTime, endTime, breakStart, breakEnd, duration };
      const newSlots = generateForPeriod(schedule);
      await Promise.all([
        api.delete('/api/physiologist/slots'),
        api.patch('/api/physiologist/schedule', schedule),
      ]);
      const res = await api.post('/api/physiologist/slots/bulk', { slots: newSlots });
      const fresh = await api.get('/api/physiologist/my-slots');
      setSlots(fresh.slots || []);
      setSuccess(`Schedule applied — ${res.count} slots created.`);
    } catch (e) {
      setError(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleDelete = async (slotId) => {
    try {
      await api.delete(`/api/physiologist/slots/${slotId}`);
      setSlots(prev => prev.filter(s => s._id !== slotId));
    } catch (e) {
      setError(e.message);
    }
  };

  const byDate = useMemo(() => slotMap(slots), [slots]);
  const calGrid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const minYear = todayObj.getFullYear();
  const minMonth = todayObj.getMonth();
  const maxYear = minMonth === 11 ? minYear + 1 : minYear;
  const maxMonth = (minMonth + 1) % 12;

  const atMin = viewYear === minYear && viewMonth === minMonth;
  const atMax = viewYear === maxYear && viewMonth === maxMonth;

  const prevMonth = () => {
    if (atMin) return;
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (atMax) return;
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0); }
    else setViewMonth(m => m + 1);
  };

  const daySlots = selectedDate
    ? [...(byDate[selectedDate] || [])].sort((a, b) => a.time.localeCompare(b.time))
    : [];
  const freeSlots = daySlots.filter(s => !s.isBooked);
  const bookedSlots = daySlots.filter(s => s.isBooked);
  const loadFailed = !loading && error && slots.length === 0;

  return (
    <AppShell>
      <PageHeader title="Availability" subtitle="Your weekly schedule and open sessions" />

      {isOnboarding && (
        <div className="banner banner-copper">
          <div>
            <p><strong>Step 2 of 2 — set your hours</strong></p>
            <p>Apply a schedule so patients can book. Video Meet links are created automatically once Google Calendar is connected.</p>
          </div>
        </div>
      )}

      {error && (
        <div className="banner" role="alert" style={{ background: 'var(--rose-tint)', color: 'var(--rose)' }}>
          <p>{error}</p>
        </div>
      )}

      <div className="stack">
        <GlassCard className="rise">
          <div className="schedule-strip">
            <div>
              <p className="label-muted">Working days</p>
              <div className="day-picks">
                {DAYS.map(day => (
                  <button
                    key={day}
                    type="button"
                    className="day-dot"
                    aria-pressed={workDays.includes(day)}
                    aria-label={day}
                    onClick={() => setWorkDays(prev => (
                      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                    ))}
                  >
                    {DAY_LETTER[day]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="label-muted">Hours</p>
              <div className="time-pair">
                <label className="time-field">
                  Start
                  <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} />
                </label>
                <label className="time-field">
                  End
                  <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} />
                </label>
              </div>
            </div>

            <div>
              <p className="label-muted">Session length</p>
              <div className="seg">
                {DURATIONS.map(d => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={duration === d}
                    onClick={() => setDuration(d)}
                  >
                    {d} min
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="schedule-extra">
            <div>
              <p className="label-muted">Break</p>
              <div className="time-pair">
                <label className="time-field">
                  Break start
                  <input type="time" value={breakStart} onChange={e => setBreakStart(e.target.value)} />
                </label>
                <label className="time-field">
                  Break end
                  <input type="time" value={breakEnd} onChange={e => setBreakEnd(e.target.value)} />
                </label>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              {success && <p className="form-success" role="status">{success}</p>}
              <button type="button" className="btn-copper" onClick={handleApply} disabled={applying}>
                {applying ? 'Applying…' : 'Apply schedule'}
              </button>
            </div>
          </div>
        </GlassCard>

        <div className="cal-layout">
          <GlassCard className="cal-card rise" style={{ animationDelay: '40ms' }}>
            <div className="cal-head">
              <h2>{MONTH_NAMES[viewMonth]} {viewYear}</h2>
              <div className="month-nav">
                <button type="button" className="icon-btn" onClick={prevMonth} disabled={atMin} aria-label="Previous month">
                  <ChevronLeftIcon size={16} />
                </button>
                <button type="button" className="icon-btn" onClick={nextMonth} disabled={atMax} aria-label="Next month">
                  <ChevronRightIcon size={16} />
                </button>
              </div>
            </div>

            {loading ? <CalendarSkeleton /> : loadFailed ? <ErrorState message={error} /> : (
              <div className="cal-scroll">
                <div className="cal-scroll-inner">
                  <div className="dow">
                    {DOW.map(d => <div key={d}>{d}</div>)}
                  </div>
                  <div className="cal-grid">
                    {calGrid.map((day, i) => {
                      if (!day) return <div key={`e-${i}`} />;
                      const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const cellSlots = byDate[dateStr] || [];
                      const avail = cellSlots.filter(s => !s.isBooked).length;
                      const bookedN = cellSlots.filter(s => s.isBooked).length;
                      const isToday = dateStr === todayStr;
                      const isSelected = dateStr === selectedDate;
                      const isWork = workDays.includes(WEEKDAY[new Date(`${dateStr}T00:00:00`).getDay()]);
                      const isPast = dateStr < todayStr;
                      const unavailable = !isSelected && cellSlots.length === 0 && (isPast || !isWork);

                      if (unavailable) {
                        return (
                          <div key={dateStr} className="day-cell is-off">
                            <span className="day-num">{day}</span>
                            <span className="sr-only">Not available</span>
                          </div>
                        );
                      }

                      return (
                        <button
                          key={dateStr}
                          type="button"
                          className={`day-cell ${isSelected ? 'is-selected' : ''}`}
                          aria-pressed={isSelected}
                          aria-label={`${fmtDate(dateStr)}, ${avail} free, ${bookedN} booked`}
                          onClick={() => setSelectedDate(dateStr)}
                        >
                          <span className="day-num">{day}</span>
                          {isToday && <span className="today-tag">Today</span>}
                          <span className="day-stats">
                            <span className="day-stat"><i className="dot dot-sage" aria-hidden="true" />{avail} free</span>
                            {bookedN > 0 && (
                              <span className="day-stat"><i className="dot dot-copper" aria-hidden="true" />{bookedN} booked</span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="legend">
              <span><i className="dot dot-sage" aria-hidden="true" /> Free sessions</span>
              <span><i className="dot dot-copper" aria-hidden="true" /> Booked</span>
              <span><i className="swatch" aria-hidden="true" /> Not available</span>
            </div>
          </GlassCard>

          <GlassCard className="day-panel rise" style={{ animationDelay: '80ms' }}>
            {loading ? <ProfileSkeleton /> : loadFailed ? <ErrorState message={error} /> : !selectedDate ? (
              <EmptyState icon={<CalendarIcon />} title="Select a day">
                Choose a day to see open and booked sessions.
              </EmptyState>
            ) : (
              <div>
                <p className="label-muted">Selected day</p>
                <h2 className="panel-date">{fmtDate(selectedDate)}</h2>
                {selectedDate === todayStr && <span className="today-tag" style={{ marginTop: 8 }}>Today</span>}

                <div className="count-tiles">
                  <div className="count-tile sage">
                    <strong>{freeSlots.length}</strong>
                    <span>Free sessions</span>
                  </div>
                  <div className="count-tile copper">
                    <strong>{bookedSlots.length}</strong>
                    <span>Booked</span>
                  </div>
                </div>

                <dl className="meta-rows">
                  <div>
                    <dt>Hours</dt>
                    <dd>{startTime} – {endTime}</dd>
                  </div>
                  <div>
                    <dt>Session length</dt>
                    <dd>{duration} minutes</dd>
                  </div>
                </dl>

                <div className="card-head" style={{ marginTop: 16 }}>
                  <h3 className="card-title">Booked session</h3>
                </div>
                {bookedSlots.length === 0 ? (
                  <p className="label-muted">No bookings on this day.</p>
                ) : bookedSlots.map(slot => (
                  <Link key={slot._id} href="/appointments" className="slot-row">
                    <span className="icon-tile"><CalendarIcon size={16} /></span>
                    <span className="patient-meta">
                      <span className="session-title">{slot.time}</span>
                      <span className="session-sub">Booked session</span>
                    </span>
                    <StatusPill status="booked" />
                    <ChevronRightIcon size={16} />
                  </Link>
                ))}

                <div className="card-head" style={{ marginTop: 16 }}>
                  <h3 className="card-title">Free slots</h3>
                </div>
                {freeSlots.length === 0 ? (
                  <p className="label-muted">No free slots on this day.</p>
                ) : (
                  <div className="slot-list">
                    {freeSlots.map(slot => (
                      <div key={slot._id} className="slot-row">
                        <span className="slot-time">{slot.time}</span>
                        <StatusPill status="free" />
                        <button
                          type="button"
                          className="btn-text-danger"
                          onClick={() => handleDelete(slot._id)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </AppShell>
  );
}

export default function AvailabilityPage() {
  return (
    <Suspense fallback={(
      <AppShell>
        <PageHeader title="Availability" subtitle="Your weekly schedule and open sessions" />
        <GlassCard><CalendarSkeleton /></GlassCard>
      </AppShell>
    )}>
      <AvailabilityInner />
    </Suspense>
  );
}
