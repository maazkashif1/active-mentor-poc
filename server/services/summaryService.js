const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOAP_KEYS = ['S', 'O', 'A', 'P'];

// Accepts the model's JSON (short or long key names) and returns { S, O, A, P } strings.
function normalizeSoap(obj) {
  const pick = (...keys) => {
    for (const k of keys) {
      const v = obj?.[k];
      if (Array.isArray(v)) return v.map(String).join('\n');
      if (v != null && String(v).trim()) return String(v).trim();
    }
    return '';
  };
  return {
    S: pick('S', 'subjective', 'Subjective'),
    O: pick('O', 'objective', 'Objective'),
    A: pick('A', 'assessment', 'Assessment'),
    P: pick('P', 'plan', 'Plan'),
  };
}

// Returns a JSON string { S, O, A, P } — the format the portal and the patient app
// parse into the four SOAP fields (same format as the seed data).
async function generateSummary(transcript, complaints) {
  const system = `You are a physiotherapy clinical documentation assistant. Write a SOAP note from a consultation transcript between a physiotherapist and a patient.

Return ONLY a JSON object with exactly these keys, each a concise plain-text string (no markdown):
- "S" (Subjective): the patient's own report — chief complaint, symptoms, pain level and behaviour, onset, history, goals.
- "O" (Objective): what was observed, measured or tested — range of motion, strength, posture, functional tests, observations.
- "A" (Assessment): the clinical impression — likely diagnosis, contributing factors, progress or severity.
- "P" (Plan): treatment plan — exercises / home programme, advice, precautions, referrals, follow-up timing.

Rules: use only information supported by the transcript or the patient's stated complaints; never invent measurements or findings. If the transcript has nothing for a section, write "Not discussed in this consultation." for that section. The transcript is auto-generated and may contain recognition errors — interpret sensibly and ignore obvious noise.`;

  const user = `Patient's stated complaints (from booking): ${complaints || 'Not provided'}

Consultation transcript:
${transcript}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 900,
  });

  const content = response.choices[0].message.content || '';
  let soap;
  try {
    soap = normalizeSoap(JSON.parse(content));
  } catch {
    // Should not happen with JSON mode; never lose the text if it does.
    soap = { S: content.trim(), O: '', A: '', P: '' };
  }
  if (!SOAP_KEYS.some(k => soap[k])) soap.S = content.trim();
  return JSON.stringify(soap);
}

async function analyzeExerciseResult({
  exerciseName, targetReps, reps, assistedReps,
  repPeakAngles, originalTargetAngle, adaptedTargetAngle,
  adaptationEvents, restAngle, restCalibrated,
  romPercent, consistency, assistedPercent,
}) {
  const adapted = adaptedTargetAngle != null && originalTargetAngle != null
    ? `The target angle was adapted from ${Math.round(originalTargetAngle)}° to ${Math.round(adaptedTargetAngle)}° (${adaptationEvents?.length ?? 0} adaptation event(s)).`
    : '';
  const peaks = repPeakAngles?.length
    ? `Rep peak angles: ${repPeakAngles.map(a => Math.round(a)).join(', ')}°.`
    : '';
  const calib = restCalibrated
    ? `Resting angle calibrated to ${Math.round(restAngle)}°.`
    : 'Resting angle was not calibrated (used default).';

  const prompt = `You are an experienced physiotherapist reviewing a patient's exercise session data. Write a concise clinical note (2-4 sentences) that a treating physiologist can read at a glance. Focus on: ROM achieved vs target, form consistency, assisted vs independent reps, and one concrete recommendation. Be direct — no preamble, no bullet points.

Exercise: ${exerciseName}
Target reps: ${targetReps}, Completed: ${reps}, Assisted: ${assistedReps}
Average ROM: ${Math.round(romPercent)}% of target angle
Form consistency (lower = better): ±${Math.round(consistency)}°
Assisted rate: ${Math.round(assistedPercent)}%
${adapted}
${peaks}
${calib}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 200,
  });

  return response.choices[0].message.content.trim();
}

module.exports = { generateSummary, analyzeExerciseResult };
