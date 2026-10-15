'use client';
import { Suspense } from 'react';
import { useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Nav from '../../components/Nav';
import { api, getToken } from '../../lib/api';

const DAYS      = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAY_INDEX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };
const DURATIONS = [15, 20, 30, 45, 60];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];
const DOW = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

function toMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function toTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}
function to12h(t) {
  let [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

function generateForPeriod({ workDays, startTime, endTime, duration, breakStart, breakEnd }) {
  const slots  = [];
  const startM = toMins(startTime);
  const endM   = toMins(endTime);
  const brkS   = breakStart ? toMins(breakStart) : null;
  const brkE   = breakEnd   ? toMins(breakEnd)   : null;

  const today   = new Date();
  today.setHours(0, 0, 0, 0);
  const endDate = new Date(today.getFullYear(), today.getMonth() + 2, 0);

  const cur = new Date(today);
  while (cur <= endDate) {
    if (workDays.some(d => DAY_INDEX[d] === cur.getDay())) {
      const dateStr = `${cur.getFullYear()}-${String(cur.getMonth()+1).padStart(2,'0')}-${String(cur.getDate()).padStart(2,'0')}`;
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
  const first    = new Date(year, month, 1);
  const last     = new Date(year, month + 1, 0);
  const startPad = (first.getDay() + 6) % 7;
  const days     = Array(startPad).fill(null);
  for (let d = 1; d <= last.getDate(); d++) days.push(d);
  while (days.length % 7 !== 0) days.push(null);
  return days;
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Day modal ─────────────────────────────────────────────────────────────────
function DayModal({ dateStr, daySlots, onClose, onDelete }) {
  const avail  = daySlots.filter(s => !s.isBooked);
  const booked = daySlots.filter(s =>  s.isBooked);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#1a1a1d] shadow-2xl"
        onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-white/8">
          <div>
            <p className="text-white font-semibold text-sm">{fmtDate(dateStr)}</p>
            <p className="text-white/35 text-xs mt-0.5">
              {avail.length} available · {booked.length} booked
            </p>
          </div>
          <button onClick={onClose}
            className="text-white/30 hover:text-white transition-colors text-lg leading-none mt-0.5">
            ×
          </button>
        </div>

        {/* Slots list */}
        <div className="p-4 max-h-80 overflow-y-auto space-y-1.5">
          {daySlots.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-6">No slots for this day.</p>
          ) : (
            daySlots.map(slot => (
              <div key={slot._id}
                className={`flex items-center justify-between rounded-lg px-3 py-2 ${
                  slot.isBooked ? 'bg-[#EC9F05]/10' : 'bg-white/[0.04]'
                }`}>
                <div className="flex items-center gap-3">
                  <span className={`tabular-nums text-sm font-medium ${
                    slot.isBooked ? 'text-[#EC9F05]' : 'text-white'
                  }`}>
                    {to12h(slot.time)}
                  </span>
                  <span className={`text-[11px] px-1.5 py-0.5 rounded ${
                    slot.isBooked
                      ? 'bg-[#EC9F05]/15 text-[#EC9F05]'
                      : 'bg-white/8 text-white/40'
                  }`}>
                    {slot.isBooked ? 'Booked' : 'Available'}
                  </span>
                </div>
                {!slot.isBooked && (
                  <button onClick={() => onDelete(slot._id)}
                    className="text-white/20 hover:text-red-400 transition-colors text-sm">
                    Remove
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
function AvailabilityInner() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const isOnboarding = searchParams.get('onboarding') === '1';

  const [workDays,   setWorkDays]   = useState(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);
  const [startTime,  setStartTime]  = useState('09:00');
  const [endTime,    setEndTime]    = useState('17:00');
  const [duration,   setDuration]   = useState(30);
  const [breakStart, setBreakStart] = useState('12:00');
  const [breakEnd,   setBreakEnd]   = useState('13:00');

  const [slots,         setSlots]         = useState([]);
  const [loading,       setLoading]       = useState(true);
  const [applying,      setApplying]      = useState(false);
  const [error,         setError]         = useState('');
  const [success,       setSuccess]       = useState('');
  const [scheduleOpen,  setScheduleOpen]  = useState(false);   // collapsed by default
  const [selectedDate,  setSelectedDate]  = useState(null);    // modal

  const todayObj = new Date();
  const [viewYear,  setViewYear]  = useState(todayObj.getFullYear());
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
        if (s.startTime)        setStartTime(s.startTime);
        if (s.endTime)          setEndTime(s.endTime);
        if (s.breakStart)       setBreakStart(s.breakStart);
        if (s.breakEnd)         setBreakEnd(s.breakEnd);
        if (s.duration)         setDuration(s.duration);
      }
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

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
      const res   = await api.post('/api/physiologist/slots/bulk', { slots: newSlots });
      const fresh = await api.get('/api/physiologist/my-slots');
      setSlots(fresh.slots || []);
      setSuccess(`Schedule applied — ${res.count} slots created.`);
      setScheduleOpen(false);
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

  const byDate  = useMemo(() => slotMap(slots), [slots]);
  const calGrid = useMemo(() => buildGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const minYear  = todayObj.getFullYear();
  const minMonth = todayObj.getMonth();
  const maxYear  = minMonth === 11 ? minYear + 1 : minYear;
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

  const modalSlots = selectedDate ? (byDate[selectedDate] || []) : [];

  return (
    <div className="flex flex-col min-h-screen bg-[#111113]">
      <Nav />
      <main className="flex-1 p-6 max-w-5xl mx-auto w-full">

        {isOnboarding && (
          <div className="mb-6 rounded-xl border border-[#DA7235]/30 bg-[#DA7235]/8 p-4">
            <p className="text-[#DA7235] font-semibold text-sm">Account created. One last step.</p>
            <p className="text-white/50 text-xs mt-0.5">Set your working hours and apply your schedule so patients can book appointments.</p>
          </div>
        )}

        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Availability</h1>
        </div>

        {/* ── Schedule (collapsible) ────────────────────────────────────── */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] mb-6 overflow-hidden">

          {/* Accordion header */}
          <button
            onClick={() => setScheduleOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-white/[0.02] transition-colors">
            <div className="flex items-center gap-3">
              <p className="text-sm font-medium text-white">Schedule</p>
              <p className="text-xs text-white/30">
                {workDays.join(', ')} · {startTime}–{endTime} · {duration}m sessions
              </p>
            </div>
            <svg className={`w-4 h-4 text-white/30 transition-transform ${scheduleOpen ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Accordion body */}
          {scheduleOpen && (
            <div className="px-6 pb-6 space-y-6 border-t border-white/5">

              {/* Working days */}
              <div className="pt-4">
                <p className="text-xs text-white/40 mb-2">Working days</p>
                <div className="flex gap-1.5 flex-wrap">
                  {DAYS.map(day => (
                    <button key={day} onClick={() => setWorkDays(prev =>
                      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
                    )}
                      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        workDays.includes(day)
                          ? 'bg-[#DA7235] text-white'
                          : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                      }`}>
                      {day}
                    </button>
                  ))}
                </div>
              </div>

              {/* Hours + break */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Start time',  val: startTime,  set: setStartTime },
                  { label: 'End time',    val: endTime,    set: setEndTime },
                  { label: 'Break start', val: breakStart, set: setBreakStart },
                  { label: 'Break end',   val: breakEnd,   set: setBreakEnd },
                ].map(({ label, val, set }) => (
                  <div key={label}>
                    <p className="text-xs text-white/40 mb-1.5">{label}</p>
                    <input type="time" value={val} onChange={e => set(e.target.value)}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-white text-sm focus:outline-none focus:border-[#DA7235]" />
                  </div>
                ))}
              </div>

              {/* Duration */}
              <div>
                <p className="text-xs text-white/40 mb-1.5">Session duration</p>
                <div className="flex gap-1.5">
                  {DURATIONS.map(d => (
                    <button key={d} onClick={() => setDuration(d)}
                      className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-colors ${
                        duration === d ? 'bg-[#DA7235] text-white' : 'bg-white/5 text-white/40 hover:bg-white/10 hover:text-white'
                      }`}>
                      {d}m
                    </button>
                  ))}
                </div>
              </div>

              {/* Apply */}
              <div className="flex items-center justify-between pt-2 border-t border-white/5">
                <div>
                  {error   && <p className="text-red-400 text-xs">{error}</p>}
                  {success && <p className="text-green-400 text-xs">{success}</p>}
                </div>
                <button onClick={handleApply} disabled={applying}
                  className="px-6 py-2.5 rounded-lg bg-[#DA7235] text-white text-sm font-semibold hover:bg-[#c5622a] transition-colors disabled:opacity-40">
                  {applying ? 'Applying…' : 'Apply Schedule'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ── Calendar ─────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-white/8 bg-white/[0.03] p-6">

          <div className="flex items-center justify-between mb-5">
            <p className="text-white font-semibold">{MONTH_NAMES[viewMonth]} {viewYear}</p>
            <div className="flex gap-1">
              <button onClick={prevMonth} disabled={atMin}
                className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                ‹
              </button>
              <button onClick={nextMonth} disabled={atMax}
                className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 text-white/50 hover:text-white text-sm flex items-center justify-center transition-colors disabled:opacity-20 disabled:cursor-not-allowed">
                ›
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DOW.map(d => (
              <div key={d} className="text-center text-[10px] text-white/25 uppercase tracking-wider pb-2">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="h-20 animate-pulse bg-white/5 rounded-lg" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-1">
              {calGrid.map((day, i) => {
                if (!day) return <div key={`e-${i}`} />;

                const dateStr  = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const daySlots = byDate[dateStr] || [];
                const avail    = daySlots.filter(s => !s.isBooked).length;
                const bookedN  = daySlots.filter(s =>  s.isBooked).length;
                const isToday  = todayObj.getFullYear() === viewYear &&
                                 todayObj.getMonth()    === viewMonth &&
                                 todayObj.getDate()     === day;

                return (
                  <button key={dateStr}
                    onClick={() => setSelectedDate(dateStr)}
                    className={`min-h-[80px] rounded-lg border p-1.5 flex flex-col gap-1 text-left transition-all hover:border-white/25 hover:bg-white/5 ${
                      isToday
                        ? 'border-[#DA7235]/50 bg-[#DA7235]/5'
                        : daySlots.length
                          ? 'border-white/10 bg-white/[0.02]'
                          : 'border-white/[0.04] bg-transparent'
                    }`}>

                    <span className={`text-[11px] font-medium leading-none ${
                      isToday ? 'text-[#DA7235]' : 'text-white/40'
                    }`}>
                      {day}
                    </span>

                    {daySlots.length > 0 && (
                      <div className="mt-auto flex flex-col gap-0.5">
                        {avail > 0 && (
                          <span className="text-[10px] text-white/40 tabular-nums">{avail} free</span>
                        )}
                        {bookedN > 0 && (
                          <span className="text-[10px] text-[#EC9F05]/70 tabular-nums">{bookedN} booked</span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* ── Day modal ──────────────────────────────────────────────────── */}
      {selectedDate && (
        <DayModal
          dateStr={selectedDate}
          daySlots={modalSlots}
          onClose={() => setSelectedDate(null)}
          onDelete={async (id) => {
            await handleDelete(id);
            // keep modal open but reflect removal
            setSelectedDate(s => s); // re-render
          }}
        />
      )}
    </div>
  );
}

export default function AvailabilityPage() {
  return <Suspense><AvailabilityInner /></Suspense>;
}
