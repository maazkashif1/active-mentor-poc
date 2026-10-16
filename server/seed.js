/**
 * seed.js — wipe + populate Mongo with test physios, patients, sessions, etc.
 * Run from /server:  node seed.js
 *
 * Passwords are plain text here — User model pre-save hashes once.
 * Slot times use 24h "HH:mm" to match portal + patient app.
 */

require('dotenv').config();
const mongoose = require('mongoose');

const User = require('./models/userModel');
const Session = require('./models/sessionModel');
const Prescription = require('./models/prescriptionModel');
const ExerciseResult = require('./models/exerciseResultModel');
const ChatThread = require('./models/chatThreadModel');
const ChatMessage = require('./models/chatMessageModel');

const PHYSIO_PW = 'Password123';
const PATIENT_PW = 'Patient123';

function todayISO() {
  return new Date().toISOString().split('T')[0];
}

function dateOffset(days) {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

const TIMES = [
  '09:00', '09:30', '10:00', '10:30', '11:00',
  '14:00', '14:30', '15:00', '15:30', '16:00', '17:00',
];

const CARE_AREAS = ['knee', 'shoulder', 'elbow', 'wrist', 'ankle', 'back'];

const COMPLAINTS = {
  knee: [
    'Sharp pain in right knee when bending. Swelling on the medial side.',
    'Post ACL reconstruction rehab — 4 months post-op. Stiffness and reduced ROM.',
    'Knee pain after long runs. Clicking sensation. Pain rated 5/10.',
    'Medial meniscus tear confirmed on MRI. Pain on stairs and squatting.',
  ],
  shoulder: [
    'Sharp pain in left shoulder when lifting arm above 90°.',
    'Rotator cuff repair — 6 weeks post-op. Limited abduction.',
    'Frozen shoulder — restricted movement in all planes. Pain worse at night.',
    'Shoulder impingement. Clicking with overhead movements.',
  ],
  elbow: [
    'Lateral elbow pain — suspected tennis elbow. Pain with gripping.',
    'Medial epicondylitis. Pain radiates down forearm.',
    'Post-fracture rehab of distal humerus. ROM restricted.',
    'Elbow stiffness after prolonged immobilisation.',
  ],
  wrist: [
    'Wrist pain after fall on outstretched hand. X-ray clear.',
    'Carpal tunnel — numbness in thumb, index and middle finger.',
    'De Quervain tenosynovitis. Pain at base of thumb.',
    'TFCC injury. Wrist pain with forearm rotation.',
  ],
  ankle: [
    'Grade II lateral ankle sprain — 3 weeks ago. Proprioception deficit.',
    'Chronic ankle instability. Multiple sprains in past 2 years.',
    'Post-fracture ankle rehab. Cast removed 2 weeks ago.',
    'Achilles tendinopathy — morning pain and stiffness.',
  ],
  back: [
    'Lower back pain — dull ache worse with sitting. Radiates to left buttock.',
    'L4/L5 disc herniation on MRI. Referred leg pain improving.',
    'Post-spinal fusion L5/S1. 3 months post-op. Cleared for physio.',
    'Non-specific lower back pain. Recurrent flares for 2 years.',
  ],
};

const RESULT_SUMMARIES = [
  'Good effort with {reps}/{target} reps at {rom}% ROM. Consistency {consistency}%. Continue current program.',
  '{reps} reps with {rom}% ROM. Assisted on {assisted}% of reps. Focus on eccentric control.',
  'ROM {rom}% with {consistency}% consistency — above expected. Consider +5° next session.',
  'Completed {reps} reps ({assisted}% assisted). ROM averaged {rom}%. Progress tracking well.',
];

function resultSummary(reps, target, rom, consistency, assisted) {
  return pick(RESULT_SUMMARIES)
    .replace('{reps}', reps).replace('{target}', target)
    .replace('{rom}', rom).replace('{consistency}', consistency)
    .replace('{assisted}', assisted);
}

const SOAP_SUMMARIES = [
  {
    S: 'Patient reports dull aching pain rated 4/10 at rest and 7/10 with movement. Morning stiffness 20–30 min.',
    O: 'Active ROM 65%. Passive ROM 80%. Strength 4−/5. Mild tenderness. No swelling.',
    A: 'Subacute musculoskeletal strain with ROM deficit. Motivated; good exercise tolerance.',
    P: 'Hand raise 3×10 pain-free. Progress +5° when consistency >85%. Review in 7 days.',
  },
  {
    S: '8 weeks post-injury. Pain 5/10 at rest, 8/10 overhead. Catching sensation in arc of movement.',
    O: 'Full passive ROM. Active 75% with end-range pain. Strength 4/5. Positive impingement tests.',
    A: 'Subacromial impingement improving. Scapular dyskinesis contributing. Good prognosis.',
    P: 'Eccentric hand raise 3×12. Scapular retraction 2×15. Avoid overhead lift >3kg. Review 10 days.',
  },
  {
    S: '4 months post ACL reconstruction. Intermittent swelling after activity. No giving way.',
    O: 'Full passive ROM. Flexion 135°. Quad 4/5. Mild valgus on single-leg squat. Incision healed.',
    A: 'Progressing well. Quad deficit and valgus under fatigue are primary impairments.',
    P: 'Continue progressive loading. Target 90% limb symmetry before RTS. Review in 3 weeks.',
  },
];

// ── Physios (portal login) ────────────────────────────────────────────────────

const PHYSIOS = [
  {
    name: 'Dr. Ahmed Khan',
    email: 'dr.ahmed.khan@yopmail.com',
    specialty: 'Knee Specialist · Sports Injury',
    yearsExperience: 12,
    bio: 'Sports physio focused on ACL rehab and return-to-sport criteria. Camera-guided home programs between clinic visits.',
    education: [
      { degree: 'DPT', institution: 'King Edward Medical University', year: '2012' },
      { degree: 'Sports Physiotherapy Cert.', institution: 'HCPC UK', year: '2016' },
    ],
    clinics: [
      { name: 'Aga Khan University Hospital', branch: 'Garden Diagnostic Centre', address: 'Karachi', city: 'Karachi', logoKey: 'aga_khan', source: 'curated' },
      { name: 'Active Mentor Sports Clinic', branch: 'Clifton', address: 'Karachi', city: 'Karachi', logoKey: '', source: 'manual' },
    ],
  },
  {
    name: 'Dr. Sania Ali',
    email: 'dr.sania.ali@yopmail.com',
    specialty: 'Shoulder Expert · Orthopedic',
    yearsExperience: 9,
    bio: 'Post-op shoulder and frozen shoulder specialist. Emphasises gradual ROM with remote form checks.',
    education: [
      { degree: 'BSPT', institution: 'Ziauddin University', year: '2014' },
      { degree: 'Orthopedic Manual Therapy', institution: 'OMT Pakistan', year: '2018' },
    ],
    clinics: [
      { name: 'Dr Ziauddin Hospital', branch: 'Clifton Campus', address: 'Karachi', city: 'Karachi', logoKey: 'ziauddin', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Omar Farooq',
    email: 'dr.omar.farooq@yopmail.com',
    specialty: 'Musculoskeletal · Back Care',
    yearsExperience: 15,
    bio: 'Chronic low-back and disc rehab. Combines manual therapy with progressive loading programs.',
    education: [{ degree: 'MSc Physiotherapy', institution: 'University of Lahore', year: '2009' }],
    clinics: [
      { name: 'Shaukat Khanum Memorial Cancer Hospital', branch: 'Johar Town', address: 'Lahore', city: 'Lahore', logoKey: 'shaukat_khanum', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Fatima Sheikh',
    email: 'dr.fatima.sheikh@yopmail.com',
    specialty: "Women's Health · Post-Surgical Rehab",
    yearsExperience: 8,
    bio: 'Post-surgical and peri-natal musculoskeletal care with gentle, measurable progressions.',
    education: [{ degree: 'DPT', institution: 'Riphah International University', year: '2015' }],
    clinics: [
      { name: 'National Hospital', branch: 'DHA Phase 5', address: 'Lahore', city: 'Lahore', logoKey: 'national_hospital', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Hassan Malik',
    email: 'dr.hassan.malik@yopmail.com',
    specialty: 'Sports Physiotherapy · Knee Rehab',
    yearsExperience: 11,
    bio: 'Team sport injuries — ACL, meniscus, and patellofemoral pain. Return-to-play focused.',
    education: [
      { degree: 'DPT', institution: 'University of Health Sciences', year: '2013' },
      { degree: 'CSCS', institution: 'NSCA', year: '2017' },
    ],
    clinics: [
      { name: 'Services Hospital', branch: 'Jail Road', address: 'Lahore', city: 'Lahore', logoKey: 'services', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Ayesha Nawaz',
    email: 'dr.ayesha.nawaz@yopmail.com',
    specialty: 'Neurological · Mobility Care',
    yearsExperience: 10,
    bio: 'Stroke and neuro rehab with emphasis on gait, balance, and home-based mobility drills.',
    education: [{ degree: 'MS NPT', institution: 'Dow University', year: '2014' }],
    clinics: [
      { name: 'Aga Khan University Hospital', branch: 'Stadium Road', address: 'Karachi', city: 'Karachi', logoKey: 'aga_khan', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Bilal Ahmad',
    email: 'dr.bilal.ahmad@yopmail.com',
    specialty: 'Elbow Care · Upper Limb',
    yearsExperience: 7,
    bio: 'Tennis/golfer’s elbow and post-fracture upper-limb rehab with grip and ROM tracking.',
    education: [{ degree: 'DPT', institution: 'Isra University', year: '2016' }],
    clinics: [
      { name: 'PIMS', branch: 'G-8/3', address: 'Islamabad', city: 'Islamabad', logoKey: 'pims', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Zara Hussain',
    email: 'dr.zara.hussain@yopmail.com',
    specialty: 'Pediatric · Musculoskeletal',
    yearsExperience: 6,
    bio: 'Adolescent sports injuries and growth-related MSK issues with family-friendly plans.',
    education: [{ degree: 'DPT', institution: 'University of Karachi', year: '2018' }],
    clinics: [
      { name: 'South City Hospital', branch: 'Clifton', address: 'Karachi', city: 'Karachi', logoKey: 'south_city', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Kamran Qureshi',
    email: 'dr.kamran.qureshi@yopmail.com',
    specialty: 'Pain Management · Orthopedic',
    yearsExperience: 14,
    bio: 'Chronic joint pain and graded exposure programs. Strong remote follow-up habit.',
    education: [{ degree: 'MPhil PT', institution: 'King Edward Medical University', year: '2010' }],
    clinics: [
      { name: 'Services Hospital', branch: 'Jail Road', address: 'Lahore', city: 'Lahore', logoKey: 'services', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Nadia Iqbal',
    email: 'dr.nadia.iqbal@yopmail.com',
    specialty: 'Ankle · Foot Rehab',
    yearsExperience: 8,
    bio: 'Ankle sprain, Achilles, and plantar issues. Proprioception and return-to-run protocols.',
    education: [{ degree: 'DPT', institution: 'FMH College of Medicine', year: '2015' }],
    clinics: [
      { name: 'Doctors Hospital & Medical Center', branch: 'Johar Town', address: 'Lahore', city: 'Lahore', logoKey: 'doctors_hospital', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Usman Baig',
    email: 'dr.usman.baig@yopmail.com',
    specialty: 'Cardiopulmonary · Geriatric',
    yearsExperience: 13,
    bio: 'Older-adult mobility and post-hospitalisation conditioning with safe home exercise.',
    education: [{ degree: 'DPT', institution: 'Liaquat University', year: '2011' }],
    clinics: [
      { name: 'PIMS', branch: 'G-8/3', address: 'Islamabad', city: 'Islamabad', logoKey: 'pims', source: 'curated' },
    ],
  },
  {
    name: 'Dr. Maryam Raza',
    email: 'dr.maryam.raza@yopmail.com',
    specialty: 'Shoulder Expert · Post-Surgical Rehab',
    yearsExperience: 9,
    bio: 'Rotator cuff and labral post-op pathways with camera-checked home sessions.',
    education: [
      { degree: 'DPT', institution: 'Bahria University', year: '2014' },
      { degree: 'Shoulder Fellowship', institution: 'AOSSM', year: '2019' },
    ],
    clinics: [
      { name: 'Dr Ziauddin Hospital', branch: 'North Nazimabad', address: 'Karachi', city: 'Karachi', logoKey: 'ziauddin', source: 'curated' },
    ],
  },
];

const PATIENTS = [
  { name: 'Asad Malik', email: 'asad.malik@yopmail.com', city: 'Lahore', careArea: 'knee', side: 'right' },
  { name: 'Hina Baig', email: 'hina.baig@yopmail.com', city: 'Karachi', careArea: 'shoulder', side: 'left' },
  { name: 'Tariq Hussain', email: 'tariq.hussain@yopmail.com', city: 'Islamabad', careArea: 'back', side: 'both' },
  { name: 'Amna Siddiqui', email: 'amna.siddiqui@yopmail.com', city: 'Lahore', careArea: 'elbow', side: 'right' },
  { name: 'Yusuf Chaudhry', email: 'yusuf.chaudhry@yopmail.com', city: 'Rawalpindi', careArea: 'knee', side: 'left' },
  { name: 'Kiran Naz', email: 'kiran.naz@yopmail.com', city: 'Faisalabad', careArea: 'wrist', side: 'right' },
  { name: 'Imran Zahid', email: 'imran.zahid@yopmail.com', city: 'Lahore', careArea: 'shoulder', side: 'right' },
  { name: 'Sara Rehman', email: 'sara.rehman@yopmail.com', city: 'Karachi', careArea: 'ankle', side: 'left' },
  { name: 'Adeel Qureshi', email: 'adeel.qureshi@yopmail.com', city: 'Islamabad', careArea: 'back', side: 'both' },
  { name: 'Meera Patel', email: 'meera.patel@yopmail.com', city: 'Karachi', careArea: 'knee', side: 'right' },
  { name: 'Faisal Abbas', email: 'faisal.abbas@yopmail.com', city: 'Multan', careArea: 'elbow', side: 'left' },
  { name: 'Zainab Khan', email: 'zainab.khan@yopmail.com', city: 'Lahore', careArea: 'shoulder', side: 'left' },
  { name: 'Hamza Farhan', email: 'hamza.farhan@yopmail.com', city: 'Peshawar', careArea: 'knee', side: 'both' },
  { name: 'Layla Ahmed', email: 'layla.ahmed@yopmail.com', city: 'Islamabad', careArea: 'wrist', side: 'left' },
  { name: 'Nadia Butt', email: 'nadia.butt@yopmail.com', city: 'Rawalpindi', careArea: 'ankle', side: 'right' },
  { name: 'Ali Hassan', email: 'ali.hassan@yopmail.com', city: 'Lahore', careArea: 'back', side: 'both' },
  { name: 'Sofia Mirza', email: 'sofia.mirza@yopmail.com', city: 'Karachi', careArea: 'shoulder', side: 'right' },
  { name: 'Usman Tariq', email: 'usman.tariq@yopmail.com', city: 'Islamabad', careArea: 'knee', side: 'left' },
  { name: 'Bilal Chishti', email: 'bilal.chishti@yopmail.com', city: 'Faisalabad', careArea: 'elbow', side: 'right' },
  { name: 'Mariam Yousaf', email: 'mariam.yousaf@yopmail.com', city: 'Quetta', careArea: 'ankle', side: 'both' },
];

function buildAvailability() {
  const slots = [];
  for (let d = 0; d <= 21; d++) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + d);
    if (date.getDay() === 0) continue; // skip Sundays
    const dateStr = date.toISOString().split('T')[0];
    const dayTimes = shuffle(TIMES).slice(0, randInt(4, 6));
    for (const time of dayTimes) {
      slots.push({ date: dateStr, time, isBooked: false });
    }
  }
  return slots;
}

async function run() {
  if (!process.env.MONGO_URI) {
    console.error('MONGO_URI missing in server/.env');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');
  console.log(`Anchor date: ${todayISO()}`);

  // ── 0. Full wipe (test DB) ──────────────────────────────────────────────────
  console.log('\n── Wiping collections ──');
  const wiped = await Promise.all([
    ChatMessage.deleteMany({}),
    ChatThread.deleteMany({}),
    ExerciseResult.deleteMany({}),
    Prescription.deleteMany({}),
    Session.deleteMany({}),
    User.deleteMany({}),
  ]);
  console.log('  cleared messages, threads, results, prescriptions, sessions, users');
  console.log(`  delete counts:`, wiped.map(r => r.deletedCount));

  // ── 1. Physios ──────────────────────────────────────────────────────────────
  console.log('\n── Creating physiologists ──');
  const physioDocs = [];
  for (const p of PHYSIOS) {
    const doc = await User.create({
      name: p.name,
      email: p.email,
      password: PHYSIO_PW, // hashed once by pre-save
      role: 'physiologist',
      specialty: p.specialty,
      yearsExperience: p.yearsExperience,
      bio: p.bio,
      education: p.education,
      clinics: p.clinics,
      photo: '',
      schedule: {
        workDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        startTime: '09:00',
        endTime: '17:00',
        breakStart: '13:00',
        breakEnd: '14:00',
        duration: 30,
      },
      availability: buildAvailability(),
    });
    physioDocs.push(doc);
    console.log(`  + ${p.name}  (${p.specialty})  slots=${doc.availability.length}`);
  }

  // ── 2. Patients ─────────────────────────────────────────────────────────────
  console.log('\n── Creating patients ──');
  const patientDocs = [];
  for (const p of PATIENTS) {
    const dob = `${randInt(1975, 2000)}-${String(randInt(1, 12)).padStart(2, '0')}-${String(randInt(1, 28)).padStart(2, '0')}`;
    const doc = await User.create({
      name: p.name,
      email: p.email,
      password: PATIENT_PW,
      role: 'patient',
      firstName: p.name.split(' ')[0],
      dob,
      city: p.city,
      careArea: p.careArea,
      side: p.side,
      onboardingAnswers: ['Yes', 'Mild', 'No', 'Sometimes'],
    });
    patientDocs.push(doc);
    console.log(`  + ${p.name}`);
  }

  // ── 3. Sessions ─────────────────────────────────────────────────────────────
  console.log('\n── Creating sessions ──');
  const sessionDocs = [];

  for (const physio of physioDocs) {
    const numSessions = randInt(5, 8);
    const assigned = shuffle(patientDocs).slice(0, numSessions);

    for (let i = 0; i < numSessions; i++) {
      const patient = assigned[i];
      const daysBack = randInt(0, 14);
      const slotDate = dateOffset(-daysBack);
      const slotTime = pick(TIMES);
      const r = Math.random();
      const status = r < 0.5 ? 'approved' : r < 0.8 ? 'summarised' : 'pending';
      const careArea = patient.careArea || pick(CARE_AREAS);
      const complaint = `[seeded] ${pick(COMPLAINTS[careArea] || COMPLAINTS.shoulder)}`;
      const hasSoap = status === 'approved' || status === 'summarised';

      const session = await Session.create({
        patientId: patient._id,
        physiologistId: physio._id,
        slotDate,
        slotTime,
        status,
        complaints: complaint,
        aiSummary: hasSoap ? JSON.stringify(pick(SOAP_SUMMARIES)) : '',
      });
      sessionDocs.push({ session, patient, physio, careArea, status });
    }
    console.log(`  ${physio.name}: ${numSessions} sessions`);
  }

  // Mark a few upcoming slots booked for realism
  for (const { session, physio } of sessionDocs.filter(s => s.status === 'pending').slice(0, 12)) {
    const slot = physio.availability.find(s => !s.isBooked);
    if (slot) {
      slot.isBooked = true;
      session.slotDate = slot.date;
      session.slotTime = slot.time;
      await session.save();
    }
  }
  for (const p of physioDocs) await p.save();

  // ── 4. Prescriptions + results ──────────────────────────────────────────────
  console.log('\n── Creating prescriptions & results ──');
  const approved = sessionDocs.filter(s => s.status === 'approved');
  let presCount = 0;
  let resultCount = 0;

  for (const { session, patient, careArea } of approved) {
    const targetReps = pick([8, 10, 12, 15]);
    const raiseAngle = randInt(70, 120);
    const lowerAngle = randInt(20, 35);

    const prescription = await Prescription.create({
      sessionId: session._id,
      patientId: patient._id,
      physiologistId: session.physiologistId,
      exerciseId: 'hand_raise',
      raiseAngleThreshold: raiseAngle,
      lowerAngleThreshold: lowerAngle,
      targetReps,
      notes: `${careArea} rehab — controlled movement, pain-free range.`,
    });
    presCount++;

    const numResults = randInt(1, 3);
    for (let r = 0; r < numResults; r++) {
      const reps = randInt(Math.floor(targetReps * 0.6), targetReps);
      const assistedReps = randInt(0, Math.floor(reps * 0.25));
      const score = Math.round((reps / targetReps) * 100);
      const romPercent = randInt(55, 95);
      const consistency = randInt(60, 95);
      const assistedPercent = Math.round((assistedReps / Math.max(reps, 1)) * 100);

      await ExerciseResult.create({
        prescriptionId: prescription._id,
        patientId: patient._id,
        reps,
        assistedReps,
        score,
        originalTargetAngle: raiseAngle,
        adaptedTargetAngle: raiseAngle + randInt(-5, 10),
        repPeakAngles: Array.from({ length: reps }, () => randInt(raiseAngle - 15, raiseAngle + 10)),
        restAngle: randInt(lowerAngle - 5, lowerAngle + 5),
        restCalibrated: true,
        analysis: {
          romPercent,
          consistency,
          assistedPercent,
          aiSummary: resultSummary(reps, targetReps, romPercent, consistency, assistedPercent),
        },
      });
      resultCount++;
    }
  }
  console.log(`  ${presCount} prescriptions, ${resultCount} results`);

  // ── 5. Sample chat threads ──────────────────────────────────────────────────
  console.log('\n── Creating sample chat threads ──');
  const chatPairs = [
    [patientDocs[0], physioDocs[0], 'Hi doctor — knee feels better after yesterday’s session.'],
    [patientDocs[1], physioDocs[1], 'Should I ice after the shoulder raises tonight?'],
    [patientDocs[4], physioDocs[4], 'Can we reschedule Thursday if something opens up?'],
  ];
  for (const [patient, physio, body] of chatPairs) {
    const thread = await ChatThread.create({
      patientId: patient._id,
      physiologistId: physio._id,
      lastMessageAt: new Date(),
      lastMessagePreview: body.slice(0, 80),
      lastSenderRole: 'patient',
      patientUnread: 0,
      physiologistUnread: 1,
    });
    await ChatMessage.create({
      threadId: thread._id,
      senderId: patient._id,
      senderRole: 'patient',
      body,
    });
    await ChatMessage.create({
      threadId: thread._id,
      senderId: physio._id,
      senderRole: 'physiologist',
      body: 'Thanks for the update — keep the home program going and message anytime.',
    });
    thread.lastMessagePreview = 'Thanks for the update — keep the home program going…';
    thread.lastSenderRole = 'physiologist';
    thread.patientUnread = 1;
    thread.physiologistUnread = 0;
    await thread.save();
    console.log(`  thread ${patient.name} ↔ ${physio.name}`);
  }

  // ── 6. Smoke-check login hash ───────────────────────────────────────────────
  const probe = await User.findOne({ email: PHYSIOS[0].email });
  const ok = await probe.comparePassword(PHYSIO_PW);
  console.log(`\n── Password check (physio): ${ok ? 'OK' : 'FAILED'} ──`);
  const probeP = await User.findOne({ email: PATIENTS[0].email });
  const okP = await probeP.comparePassword(PATIENT_PW);
  console.log(`── Password check (patient): ${okP ? 'OK' : 'FAILED'} ──`);

  const totals = {
    physios: physioDocs.length,
    patients: patientDocs.length,
    sessions: sessionDocs.length,
    approved: approved.length,
    summarised: sessionDocs.filter(s => s.status === 'summarised').length,
    pending: sessionDocs.filter(s => s.status === 'pending').length,
    prescriptions: presCount,
    results: resultCount,
    chats: chatPairs.length,
  };

  console.log('\n── Done ──');
  console.log(totals);
  await mongoose.disconnect();
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
