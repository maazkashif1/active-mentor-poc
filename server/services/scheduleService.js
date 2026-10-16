/** Build bookable availability slots from a physio schedule config. */

const DAY_INDEX = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 0 };

const DEFAULT_SCHEDULE = {
  workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  startTime: '09:00',
  endTime: '17:00',
  breakStart: '13:00',
  breakEnd: '14:00',
  duration: 30,
};

function toMins(t) {
  if (!t || typeof t !== 'string') return null;
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function toTimeStr(mins) {
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
}

function localISODate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * @param {object} schedule
 * @param {{ daysAhead?: number }} [opts]
 * @returns {{ date: string, time: string, isBooked: boolean }[]}
 */
function generateSlotsFromSchedule(schedule = {}, opts = {}) {
  const cfg = { ...DEFAULT_SCHEDULE, ...schedule };
  const workDays = Array.isArray(cfg.workDays) && cfg.workDays.length
    ? cfg.workDays
    : DEFAULT_SCHEDULE.workDays;
  const duration = Number(cfg.duration) > 0 ? Number(cfg.duration) : 30;
  const startM = toMins(cfg.startTime) ?? toMins(DEFAULT_SCHEDULE.startTime);
  const endM = toMins(cfg.endTime) ?? toMins(DEFAULT_SCHEDULE.endTime);
  const brkS = toMins(cfg.breakStart);
  const brkE = toMins(cfg.breakEnd);
  const daysAhead = opts.daysAhead ?? 42; // ~6 weeks

  const slots = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < daysAhead; i++) {
    const cur = new Date(today);
    cur.setDate(today.getDate() + i);
    if (!workDays.some(d => DAY_INDEX[d] === cur.getDay())) continue;

    const dateStr = localISODate(cur);
    let t = startM;
    while (t + duration <= endM) {
      const inBreak = brkS != null && brkE != null && !(t + duration <= brkS || t >= brkE);
      if (!inBreak) {
        slots.push({ date: dateStr, time: toTimeStr(t), isBooked: false });
      }
      t += duration;
    }
  }
  return slots;
}

/** Keep booked slots; replace open ones with a fresh schedule window. */
function mergeAvailability(existing = [], schedule) {
  const booked = (existing || []).filter(s => s.isBooked);
  const fresh = generateSlotsFromSchedule(schedule);
  const bookedKeys = new Set(booked.map(s => `${s.date}|${s.time}`));
  const open = fresh.filter(s => !bookedKeys.has(`${s.date}|${s.time}`));
  return [...booked, ...open].sort((a, b) =>
    a.date === b.date ? a.time.localeCompare(b.time) : a.date.localeCompare(b.date),
  );
}

function isSlotOpenAndFuture(slot, now) {
  // Guard: Array#filter may pass index as 2nd arg — only treat real Dates as `now`
  const ref = now instanceof Date ? now : new Date();
  if (!slot || slot.isBooked) return false;
  const date = String(slot.date || '');
  const time = String(slot.time || '00:00');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const when = new Date(y, m - 1, d, h || 0, min || 0, 0, 0);
  return when.getTime() > ref.getTime();
}

module.exports = {
  DEFAULT_SCHEDULE,
  generateSlotsFromSchedule,
  mergeAvailability,
  isSlotOpenAndFuture,
  localISODate,
};
