// Sadaan Attempt
// Slots are stored as wall-clock strings ("2026-10-20", "10:00") in the physio's
// local timezone. `new Date(y, m, d, h, min)` interprets them in the *server's*
// timezone (UTC on Render), shifting every meeting by the UTC offset. These
// helpers convert slot strings to the correct UTC instant for APP_TIMEZONE.

const APP_TIMEZONE = process.env.APP_TIMEZONE || 'Asia/Karachi';

// Offset (ms) of `timeZone` from UTC at the given instant.
function tzOffsetMs(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = type => Number(parts.find(p => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - date.getTime();
}

/** "YYYY-MM-DD" + "HH:mm" in `timeZone` → Date (correct UTC instant). */
function slotToDate(slotDate, slotTime, timeZone = APP_TIMEZONE) {
  const [y, m, d] = slotDate.split('-').map(Number);
  const [h, min] = slotTime.split(':').map(Number);
  const wallAsUtc = Date.UTC(y, m - 1, d, h, min);
  // Two passes so DST transitions resolve correctly.
  let utc = wallAsUtc - tzOffsetMs(new Date(wallAsUtc), timeZone);
  utc = wallAsUtc - tzOffsetMs(new Date(utc), timeZone);
  return new Date(utc);
}

module.exports = { APP_TIMEZONE, slotToDate };
