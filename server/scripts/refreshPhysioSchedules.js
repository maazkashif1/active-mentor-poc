/**
 * Refresh every physiologist's open availability from their schedule config.
 * Keeps booked slots. Run: node scripts/refreshPhysioSchedules.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const User = require('../models/userModel');
const { DEFAULT_SCHEDULE, mergeAvailability } = require('../services/scheduleService');

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGO_URI);
  const physios = await User.find({ role: 'physiologist' });
  console.log(`Refreshing schedules for ${physios.length} physiologists…`);

  for (const p of physios) {
    const schedule = {
      ...DEFAULT_SCHEDULE,
      ...(p.schedule?.toObject ? p.schedule.toObject() : p.schedule || {}),
    };
    if (!p.schedule?.startTime) {
      p.schedule = schedule;
    }
    const before = (p.availability || []).length;
    p.availability = mergeAvailability(p.availability, schedule);
    await p.save();
    const open = p.availability.filter(s => !s.isBooked).length;
    console.log(`  ✓ ${p.name}: ${before} → ${p.availability.length} slots (${open} open)`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
