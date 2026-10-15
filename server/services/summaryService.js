const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function generateSummary(transcript, complaints) {
  const prompt = `You are a medical assistant. Based on the consultation transcript and patient complaints, generate a structured medical summary covering:
1. Chief Complaint
2. History of Presenting Illness
3. Key Findings from Consultation
4. Assessment
5. Recommended Plan

Patient complaints: ${complaints}

Transcript:
${transcript}`;

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    max_tokens: 800,
  });

  return response.choices[0].message.content;
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
