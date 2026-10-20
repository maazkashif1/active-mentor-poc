// Exercise recordings: make every video playable in every browser, and serve it with a
// fresh link on each request.
//
// - Phones may record HEVC/H.265 (iPhone default), which Firefox and many Windows/Chrome
//   setups cannot play. Anything that is not H.264 is converted to H.264 MP4
//   (yuv420p, ≤720p, fast-start) with ffmpeg, in a single background worker.
// - Results store the object *key* (not a presigned URL, which expires after 7 days);
//   playback URLs are signed when the portal asks for them.
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pipeline } = require('stream/promises');
const { execFile } = require('child_process');
const { randomUUID } = require('crypto');
const { GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const ExerciseResult = require('../models/exerciseResultModel');
const { s3, bucket, signedGetUrl, keyFromUrl } = require('./storage');

let ffmpegPath = null;
try { ffmpegPath = require('ffmpeg-static'); } catch { /* reported when used */ }

const MAX_ATTEMPTS = 3;
const STALE_PROCESSING_MS = 30 * 60 * 1000;
const WORKER_TICK_MS = 60 * 1000;

const run = (args, timeoutMs = 15 * 60 * 1000) => new Promise((resolve, reject) => {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    reject(new Error('ffmpeg binary is not available on this server'));
    return;
  }
  execFile(ffmpegPath, args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
    // `ffmpeg -i file` (probe) always exits non-zero; callers read stderr.
    resolve({ err, stdout, stderr: String(stderr || '') });
  });
});

// Codec of the first video stream, e.g. "h264", "hevc".
async function probeVideoCodec(file) {
  const { stderr } = await run(['-hide_banner', '-i', file], 60 * 1000);
  const m = stderr.match(/Stream #\S+.*?Video:\s*([a-z0-9_]+)/i);
  return m ? m[1].toLowerCase() : null;
}

async function transcodeToH264(input, output) {
  const { err, stderr } = await run([
    '-hide_banner', '-y', '-i', input,
    '-map', '0:v:0', '-an',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26',
    '-profile:v', 'high', '-level', '4.0', '-pix_fmt', 'yuv420p',
    // ≤720p on the long edge, even dimensions; keeps portrait/landscape orientation
    '-vf', "scale='if(gt(iw,ih),min(1280,iw),-2)':'if(gt(iw,ih),-2,min(1280,ih))'",
    '-movflags', '+faststart',
    '-threads', '2',
    output,
  ]);
  if (err) throw new Error(`ffmpeg failed: ${stderr.split('\n').filter(Boolean).slice(-3).join(' | ')}`);
}

async function download(key, file) {
  const { Body } = await s3.send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  await pipeline(Body, fs.createWriteStream(file));
}

async function upload(file, key) {
  await s3.send(new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    Body: fs.createReadStream(file),
    ContentLength: fs.statSync(file).size,
    ContentType: 'video/mp4',
    CacheControl: 'private, max-age=86400',
  }));
}

// Converts one result's recording if needed. Safe to call repeatedly / concurrently:
// the atomic claim lets only one caller work on a result.
async function processResultVideo(resultId) {
  const claimed = await ExerciseResult.findOneAndUpdate(
    {
      _id: resultId,
      videoStatus: { $nin: ['ready', 'processing'] },
      // Results saved before video processing existed have no counter: treat as 0.
      $or: [{ videoAttempts: { $exists: false } }, { videoAttempts: null }, { videoAttempts: { $lt: MAX_ATTEMPTS } }],
    },
    { videoStatus: 'processing', videoProcessingAt: new Date(), $inc: { videoAttempts: 1 } },
    { new: true },
  );
  if (!claimed) return;

  const sourceKey = claimed.videoKey || keyFromUrl(claimed.videoUrl);
  if (!sourceKey) {
    await ExerciseResult.updateOne({ _id: resultId }, { videoStatus: 'none' });
    return;
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'am-video-'));
  const input = path.join(dir, 'in');
  const output = path.join(dir, 'out.mp4');
  try {
    await download(sourceKey, input);
    const codec = await probeVideoCodec(input);
    if (codec === 'h264') {
      await ExerciseResult.updateOne({ _id: resultId }, { videoKey: sourceKey, videoStatus: 'ready', videoError: '' });
      console.log(`[video] result=${resultId} already H.264 — ready`);
      return;
    }
    const started = Date.now();
    await transcodeToH264(input, output);
    const playableKey = `videos/${randomUUID()}.mp4`;
    await upload(output, playableKey);
    await ExerciseResult.updateOne({ _id: resultId }, {
      videoKey: playableKey,
      videoOriginalKey: sourceKey, // original kept for audit / re-processing
      videoStatus: 'ready',
      videoError: '',
    });
    const mb = n => (n / 1e6).toFixed(1);
    console.log(`[video] result=${resultId} ${codec || 'unknown'} → H.264 in ${Math.round((Date.now() - started) / 1000)}s (${mb(fs.statSync(input).size)}MB → ${mb(fs.statSync(output).size)}MB)`);
  } catch (err) {
    console.error(`[video] result=${resultId} processing failed: ${err.message}`);
    await ExerciseResult.updateOne({ _id: resultId }, {
      videoKey: claimed.videoKey || sourceKey,
      videoStatus: 'failed',
      videoError: err.message.slice(0, 500),
    });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// One video at a time keeps memory/CPU predictable on a small instance.
let queue = Promise.resolve();
function enqueueVideo(resultId) {
  queue = queue.then(() => processResultVideo(resultId)).catch(() => {});
  return queue;
}

let ticking = false;
async function tick() {
  if (ticking) return;
  ticking = true;
  try {
    const due = await ExerciseResult.find({
      $and: [
        { $or: [{ videoKey: { $nin: [null, ''] } }, { videoUrl: { $nin: [null, ''] } }] },
        { $or: [{ videoAttempts: { $exists: false } }, { videoAttempts: { $lt: MAX_ATTEMPTS } }] },
        {
          $or: [
            { videoStatus: { $in: [null, 'pending', 'failed'] } },
            { videoStatus: { $exists: false } },
            { videoStatus: 'processing', videoProcessingAt: { $lt: new Date(Date.now() - STALE_PROCESSING_MS) } },
          ],
        },
      ],
    }).select('_id videoStatus').sort({ createdAt: -1 }).limit(10);
    for (const r of due) {
      // Release stale claims left by a restart mid-conversion.
      if (r.videoStatus === 'processing') await ExerciseResult.updateOne({ _id: r._id }, { videoStatus: 'pending' });
      await enqueueVideo(r._id);
    }
  } catch (err) {
    console.error('[video] worker error:', err.message);
  } finally {
    ticking = false;
  }
}

function startVideoWorker() {
  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    console.warn('[video] ffmpeg not found — recordings will be served as uploaded (may not play in every browser).');
  }
  setInterval(tick, WORKER_TICK_MS);
  setTimeout(tick, 5000);
}

// Playback fields for API responses. Never exposes stored (expiring) URLs.
//   videoStatus: 'none' | 'pending' | 'processing' | 'ready' | 'failed'
//   videoUrl:    fresh signed link when playable in every browser, else null
//   videoOriginalUrl: fresh link to the original upload (fallback / download)
async function playbackFields(result) {
  const r = result.toObject ? result.toObject() : { ...result };
  const originalKey = r.videoOriginalKey || (r.videoStatus === 'ready' ? null : (r.videoKey || keyFromUrl(r.videoUrl)));
  const hasVideo = !!(r.videoKey || r.videoUrl);
  const status = !hasVideo ? 'none' : (r.videoStatus || 'pending');
  let videoUrl = null;
  let videoOriginalUrl = null;
  try {
    if (status === 'ready' && r.videoKey) videoUrl = await signedGetUrl(r.videoKey);
    if (originalKey && status !== 'ready') videoOriginalUrl = await signedGetUrl(originalKey);
  } catch (err) {
    console.error('[video] could not sign playback URL:', err.message);
  }
  delete r.videoKey;
  delete r.videoOriginalKey;
  delete r.videoAttempts;
  delete r.videoProcessingAt;
  return { ...r, videoStatus: status, videoUrl, videoOriginalUrl };
}

module.exports = {
  enqueueVideo,
  startVideoWorker,
  playbackFields,
  probeVideoCodec,
  transcodeToH264,
};
