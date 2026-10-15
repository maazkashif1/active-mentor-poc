/**
 * seed.js — populate dev database with realistic mock data
 * Run: node seed.js  (from /server directory)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const User         = require('./models/userModel');
const Session      = require('./models/sessionModel');
const Prescription = require('./models/prescriptionModel');
const ExerciseResult = require('./models/exerciseResultModel');

// ── helpers ──────────────────────────────────────────────────────────────────

function dateOffset(days) {
  const d = new Date('2026-10-15');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

const TIMES = ['09:00 AM','09:30 AM','10:00 AM','10:30 AM','11:00 AM',
               '02:00 PM','02:30 PM','03:00 PM','03:30 PM','04:00 PM','05:00 PM'];

const CITIES = ['Lahore','Karachi','Islamabad','Rawalpindi','Faisalabad','Multan','Peshawar','Quetta'];
const CARE_AREAS = ['knee','shoulder','elbow','wrist','ankle','back'];

const COMPLAINTS = {
  knee: [
    'Sharp pain in right knee when bending. Swelling on the medial side. Worsens after walking.',
    'Post ACL reconstruction rehab — 4 months post-op. Stiffness and reduced range of motion.',
    'Knee pain after long runs. No swelling but clicking sensation. Pain rated 5/10.',
    'Medial meniscus tear confirmed on MRI. Pain on stairs and squatting movements.',
  ],
  shoulder: [
    'Sharp pain in left shoulder when lifting arm above 90°. Started after gym session 3 weeks ago.',
    'Rotator cuff repair — 6 weeks post-op. Limited abduction. Physiotherapy ordered by surgeon.',
    'Frozen shoulder — restricted movement in all planes. Pain worse at night. Duration 4 months.',
    'Shoulder impingement syndrome. Clicking and catching with overhead movements.',
  ],
  elbow: [
    'Lateral elbow pain — suspected tennis elbow. Pain with gripping and wrist extension.',
    'Medial epicondylitis. Pain radiates down forearm. Occupation: plumber.',
    'Post-fracture rehabilitation of distal humerus. ROM restricted to 60° flexion currently.',
    'Elbow stiffness after prolonged immobilisation. Seeking manual therapy and exercise program.',
  ],
  wrist: [
    'Wrist pain after fall on outstretched hand. X-ray clear but persistent pain with loading.',
    'Carpal tunnel syndrome — numbness in thumb, index and middle finger. Worse at night.',
    'De Quervain tenosynovitis. Pain at base of thumb with gripping and pinching.',
    'TFCC injury. Wrist pain with forearm rotation. MRI confirmed partial tear.',
  ],
  ankle: [
    'Grade II lateral ankle sprain — 3 weeks ago. Bruising resolved but proprioception deficit.',
    'Chronic ankle instability. Multiple sprains in past 2 years. Seeking strengthening program.',
    'Post-fracture ankle rehabilitation. Cast removed 2 weeks ago. Significant stiffness.',
    'Achilles tendinopathy — pain and stiffness in the morning. Recreational runner.',
  ],
  back: [
    'Lower back pain — dull ache worse with sitting. Radiates to left buttock. Office worker.',
    'L4/L5 disc herniation confirmed on MRI. Referred leg pain improving. Seeking rehab.',
    'Post-spinal fusion L5/S1. 3 months post-op. Cleared for physiotherapy by neurosurgeon.',
    'Non-specific lower back pain. Recurrent flares for 2 years. Looking for a long-term plan.',
  ],
};

// Per-result exercise summaries (plain text — about performance, not clinical SOAP)
const RESULT_SUMMARIES = [
  'Patient demonstrates good effort with {reps}/{target} reps completed at {rom}% ROM. Consistency was {consistency}% across the session. Adaptive threshold adjustments were appropriate. Continue current program with gradual angle progression.',
  'Session shows {reps} repetitions achieved with {rom}% ROM. Minor assisted compensation noted at {assisted}% of reps. Recommend focusing on eccentric control and ensuring full return to rest position between reps.',
  'ROM at {rom}% of target with {consistency}% rep consistency — above expected benchmark for this stage of recovery. Patient tolerance good. Consider increasing target angle by 5° at next session.',
  'Patient completed {reps} reps with {assisted}% assisted. ROM averaged {rom}%. Some fatigue compensation observed in later reps. Ice post-session recommended. Overall progress is tracking well.',
];

function resultSummary(reps, target, rom, consistency, assisted) {
  return pick(RESULT_SUMMARIES)
    .replace('{reps}', reps).replace('{target}', target)
    .replace('{rom}', rom).replace('{consistency}', consistency)
    .replace('{assisted}', assisted);
}

// Session-level SOAP summaries (stored as JSON)
const SOAP_SUMMARIES = [
  {
    S: 'Patient reports dull aching pain in the affected area, rated 4/10 at rest and 7/10 with active movement. Symptoms present for approximately 6 weeks with gradual onset. Reports morning stiffness lasting 20–30 minutes. Sleep disruption on the affected side noted.',
    O: 'Active ROM 65% of expected normal. Passive ROM 80%. Strength testing 4−/5 against resistance. Mild tenderness on palpation of the primary muscle groups. No swelling or erythema. Posture shows compensatory elevation of the affected shoulder.',
    A: 'Presentation consistent with subacute musculoskeletal strain with associated ROM deficit and mild strength impairment. Patient motivated and demonstrates adequate exercise tolerance for a progressive home program.',
    P: 'Initiate hand raise protocol: 3 sets × 10 reps, pain-free range only. Progress target angle by 5° when consistency exceeds 85%. Apply ice 10 min post-exercise. Review in 7 days. Educate patient on posture correction during daily activities.',
  },
  {
    S: 'Patient presents 8 weeks post-injury with ongoing pain (5/10 at rest, 8/10 during overhead activity). Reports significant improvement from initial presentation. Describes a "catching" sensation with specific arc of movement. No neurological symptoms.',
    O: 'Full passive ROM achieved. Active ROM 75% with pain at end range. Isometric strength 4/5. Scapular stabilisation assessment reveals mild dyskinesis. Provocative tests positive for impingement. Gait and posture normal.',
    A: 'Clinical findings suggest subacromial impingement with improving ROM trajectory. Scapular dyskinesis contributing to functional limitation. Patient compliant with previous advice. Good prognosis for full return to activity within 4–6 weeks.',
    P: 'Progress to eccentric-focused hand raise 3 × 12 reps. Add scapular retraction exercises 2 × 15. Patient to continue home program twice daily. Avoid overhead reaching and lifting >3 kg until review. Next appointment in 10 days.',
  },
  {
    S: 'Patient is 4 months post-operative following ACL reconstruction. Reports intermittent swelling and aching (3/10) after prolonged activity. Confident in ADLs but anxious about return to sport. No incidents of giving way since surgery.',
    O: 'Full passive ROM. Active flexion to 135°. Extension lag nil. Quad strength 4/5, hamstring 4+/5. Single leg squat shows mild valgus collapse at 30°. No joint effusion at rest. Incision well healed.',
    A: 'Patient progressing well in post-operative rehabilitation. Quad deficit and valgus collapse under fatigue are primary impairments to address before return to sport criteria are met. Psychological readiness remains an important consideration.',
    P: 'Continue progressive loading program. Initiate hand raise protocol to address upper extremity stability in parallel with lower limb work. Target 90% limb symmetry on functional testing before return to sport clearance. Review in 3 weeks.',
  },
  {
    S: 'New patient presenting with 3-week history of lateral elbow and wrist pain. Onset after increased workload (occupation: desk-based). Rates pain 6/10 with typing and gripping. Denies trauma. Taking OTC analgesics with partial relief.',
    O: 'Grip strength reduced 35% compared to unaffected side. Resisted wrist extension and forearm supination painful. Tenderness at lateral epicondyle on palpation. Full ROM preserved. Neural tension testing negative. No swelling.',
    A: 'Clinical presentation consistent with lateral epicondylalgia. Likely overuse mechanism related to occupational demands. Patient has realistic expectations and good understanding of condition. Conservative management appropriate.',
    P: 'Prescribe hand raise with eccentric emphasis: 3 × 8 reps with 3-second eccentric phase. Ergonomic review of workstation recommended. Load modification for 2 weeks. Advise relative rest from aggravating activities.',
  },
  {
    S: 'Patient reports chronic lower back pain (VAS 5/10) worsening over 2 months. Radiates to left buttock but no leg pain or neurological symptoms. Morning stiffness approximately 40 minutes. Activity helps temporarily.',
    O: 'Lumbar flexion 60% of normal. Extension mildly restricted. SLR negative bilaterally. Core and hip stabiliser strength 3+/5. No sensory or reflex changes. Postural assessment reveals anterior pelvic tilt and hyperlordosis.',
    A: 'Non-specific chronic lower back pain with deconditioning and postural impairments. No red flags identified. Contributing factors include sedentary occupation, hip flexor tightness, and poor core activation.',
    P: 'Begin graduated strengthening with hand raise protocol to establish movement patterns and confidence. 3 × 10 reps, neutral spine throughout. Add hip flexor stretch twice daily. Walking 20 min daily. Review in 2 weeks.',
  },
];

// ── patient data ──────────────────────────────────────────────────────────────

const PATIENTS = [
  { name: 'Asad Malik',      email: 'asad.malik@yopmail.com',      city: 'Lahore',      careArea: 'knee',     side: 'right' },
  { name: 'Hina Baig',       email: 'hina.baig@yopmail.com',       city: 'Karachi',     careArea: 'shoulder', side: 'left'  },
  { name: 'Tariq Hussain',   email: 'tariq.hussain@yopmail.com',   city: 'Islamabad',   careArea: 'back',     side: 'both'  },
  { name: 'Amna Siddiqui',   email: 'amna.siddiqui@yopmail.com',   city: 'Lahore',      careArea: 'elbow',    side: 'right' },
  { name: 'Yusuf Chaudhry',  email: 'yusuf.chaudhry@yopmail.com',  city: 'Rawalpindi',  careArea: 'knee',     side: 'left'  },
  { name: 'Kiran Naz',       email: 'kiran.naz@yopmail.com',       city: 'Faisalabad',  careArea: 'wrist',    side: 'right' },
  { name: 'Imran Zahid',     email: 'imran.zahid@yopmail.com',     city: 'Lahore',      careArea: 'shoulder', side: 'right' },
  { name: 'Sara Rehman',     email: 'sara.rehman@yopmail.com',     city: 'Karachi',     careArea: 'ankle',    side: 'left'  },
  { name: 'Adeel Qureshi',   email: 'adeel.qureshi@yopmail.com',   city: 'Islamabad',   careArea: 'back',     side: 'both'  },
  { name: 'Meera Patel',     email: 'meera.patel@yopmail.com',     city: 'Karachi',     careArea: 'knee',     side: 'right' },
  { name: 'Faisal Abbas',    email: 'faisal.abbas@yopmail.com',    city: 'Multan',      careArea: 'elbow',    side: 'left'  },
  { name: 'Zainab Khan',     email: 'zainab.khan@yopmail.com',     city: 'Lahore',      careArea: 'shoulder', side: 'left'  },
  { name: 'Hamza Farhan',    email: 'hamza.farhan@yopmail.com',    city: 'Peshawar',    careArea: 'knee',     side: 'both'  },
  { name: 'Layla Ahmed',     email: 'layla.ahmed@yopmail.com',     city: 'Islamabad',   careArea: 'wrist',    side: 'left'  },
  { name: 'Nadia Butt',      email: 'nadia.butt@yopmail.com',      city: 'Rawalpindi',  careArea: 'ankle',    side: 'right' },
  { name: 'Ali Hassan',      email: 'ali.hassan@yopmail.com',      city: 'Lahore',      careArea: 'back',     side: 'both'  },
  { name: 'Sofia Mirza',     email: 'sofia.mirza@yopmail.com',     city: 'Karachi',     careArea: 'shoulder', side: 'right' },
  { name: 'Usman Tariq',     email: 'usman.tariq@yopmail.com',     city: 'Islamabad',   careArea: 'knee',     side: 'left'  },
  { name: 'Bilal Chishti',   email: 'bilal.chishti@yopmail.com',   city: 'Faisalabad',  careArea: 'elbow',    side: 'right' },
  { name: 'Mariam Yousaf',   email: 'mariam.yousaf@yopmail.com',   city: 'Quetta',      careArea: 'ankle',    side: 'both'  },
];

// ── main ──────────────────────────────────────────────────────────────────────

async function run() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB');

  const patientPassword = await bcrypt.hash('Patient123', 10);

  // ── 1. Upsert patients ──────────────────────────────────────────────────────
  console.log('\n── Creating patients ──');
  const patientDocs = [];
  for (const p of PATIENTS) {
    const existing = await User.findOne({ email: p.email });
    if (existing) {
      patientDocs.push(existing);
      console.log(`  skip  ${p.name} (exists)`);
      continue;
    }
    const dob = `${randInt(1975, 2000)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`;
    const doc = await User.create({
      name: p.name, email: p.email, password: patientPassword, role: 'patient',
      firstName: p.name.split(' ')[0],
      dob, city: p.city, careArea: p.careArea, side: p.side,
      onboardingAnswers: ['Yes', 'Mild', 'No', 'Sometimes'],
    });
    patientDocs.push(doc);
    console.log(`  created ${p.name}`);
  }

  // ── 2. Load physios ──────────────────────────────────────────────────────────
  const physios = await User.find({ role: 'physiologist' });
  console.log(`\n── Found ${physios.length} physiologists ──`);

  // ── 3. Add future slots to physios ──────────────────────────────────────────
  console.log('\n── Adding future slots ──');
  for (const physio of physios) {
    const newSlots = [];
    for (let d = 1; d <= 14; d++) {
      if (d % 7 === 0) continue; // skip Sundays-ish
      const date = dateOffset(d);
      // 3-4 slots per day
      const dayTimes = shuffle(TIMES).slice(0, randInt(3,4));
      for (const time of dayTimes) {
        const alreadyExists = physio.availability.some(s => s.date === date && s.time === time);
        if (!alreadyExists) newSlots.push({ date, time, isBooked: false });
      }
    }
    if (newSlots.length) {
      physio.availability.push(...newSlots);
      await physio.save();
      console.log(`  ${physio.name}: +${newSlots.length} slots`);
    }
  }

  // ── 4. Create sessions ───────────────────────────────────────────────────────
  console.log('\n── Creating sessions ──');
  // Delete existing seeded sessions to keep things clean on re-run
  await Session.deleteMany({ complaints: /seeded/i });

  const sessionDocs = [];

  // For each physio, create 5-8 sessions across the last 14 days
  for (const physio of physios) {
    const numSessions = randInt(5, 8);
    const assignedPatients = shuffle(patientDocs).slice(0, numSessions);

    for (let i = 0; i < numSessions; i++) {
      const patient = assignedPatients[i];
      const daysBack = randInt(1, 14);
      const slotDate = dateOffset(-daysBack);
      const slotTime = pick(TIMES);

      // Status distribution: 50% approved, 30% summarised, 20% pending
      const r = Math.random();
      const status = r < 0.5 ? 'approved' : r < 0.8 ? 'summarised' : 'pending';

      const careArea = patient.careArea || pick(CARE_AREAS);
      const complaint = pick(COMPLAINTS[careArea] || COMPLAINTS.shoulder);

      const hasSoap = status === 'approved' || status === 'summarised';
      const session = await Session.create({
        patientId:       patient._id,
        physiologistId:  physio._id,
        slotDate, slotTime, status,
        complaints: complaint,
        aiSummary: hasSoap ? JSON.stringify(pick(SOAP_SUMMARIES)) : '',
      });
      sessionDocs.push({ session, patient, physio, careArea, status });
    }
    console.log(`  ${physio.name}: ${numSessions} sessions`);
  }

  // ── 5. Create prescriptions + results for approved sessions ──────────────────
  console.log('\n── Creating prescriptions & exercise results ──');

  const approved = sessionDocs.filter(s => s.status === 'approved');
  let presCount = 0, resultCount = 0;

  for (const { session, patient, careArea } of approved) {
    const targetReps = pick([8, 10, 12, 15]);
    const raiseAngle = randInt(70, 120);
    const lowerAngle = randInt(20, 35);
    const notes = `${careArea.charAt(0).toUpperCase() + careArea.slice(1)} rehabilitation protocol. Focus on controlled movement and pain-free range. Rest between sets.`;

    const prescription = await Prescription.create({
      sessionId:          session._id,
      patientId:          patient._id,
      physiologistId:     session.physiologistId,
      exerciseId:         'hand_raise',
      raiseAngleThreshold: raiseAngle,
      lowerAngleThreshold: lowerAngle,
      targetReps,
      notes,
    });
    presCount++;

    // 1-3 exercise results per prescription (simulates multiple sessions done)
    const numResults = randInt(1, 3);
    for (let r = 0; r < numResults; r++) {
      const reps = randInt(Math.floor(targetReps * 0.6), targetReps);
      const assistedReps = randInt(0, Math.floor(reps * 0.25));
      const score = Math.round((reps / targetReps) * 100);
      const romPercent = randInt(55, 95);
      const consistency = randInt(60, 95);
      const assistedPercent = Math.round((assistedReps / Math.max(reps, 1)) * 100);
      const repAngles = Array.from({ length: reps }, () => randInt(raiseAngle - 15, raiseAngle + 10));
      const restAngle = randInt(lowerAngle - 5, lowerAngle + 5);

      await ExerciseResult.create({
        prescriptionId: prescription._id,
        patientId:      patient._id,
        reps, assistedReps, score,
        originalTargetAngle: raiseAngle,
        adaptedTargetAngle:  raiseAngle + randInt(-5, 10),
        repPeakAngles: repAngles,
        restAngle, restCalibrated: true,
        analysis: {
          romPercent, consistency, assistedPercent,
          aiSummary: resultSummary(reps, targetReps, romPercent, consistency, assistedPercent),
        },
      });
      resultCount++;
    }
  }

  console.log(`  ${presCount} prescriptions, ${resultCount} exercise results`);

  // ── 6. Summary ────────────────────────────────────────────────────────────────
  const totals = {
    patients:    patientDocs.length,
    sessions:    sessionDocs.length,
    approved:    approved.length,
    summarised:  sessionDocs.filter(s => s.status === 'summarised').length,
    pending:     sessionDocs.filter(s => s.status === 'pending').length,
    prescriptions: presCount,
    results:     resultCount,
  };

  console.log('\n── Done ──────────────────────────────────────────────────────────');
  console.log(totals);
  await mongoose.disconnect();
}

run().catch(e => { console.error(e); process.exit(1); });
