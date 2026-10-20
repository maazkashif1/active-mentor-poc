const express = require('express');
const { randomUUID } = require('crypto');
const verifyToken = require('../middleware/auth');
const { signedGetUrl, signedPutUrl } = require('../services/storage');

const router = express.Router();

const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif']);

function contentTypeFor(ext, kind) {
  if (kind === 'image' || IMAGE_EXTS.has(ext)) {
    const mime = ext === 'jpg' ? 'jpeg' : ext;
    return `image/${mime}`;
  }
  return `video/${ext}`;
}

// GET /api/upload/presigned?ext=mp4
// GET /api/upload/presigned?ext=jpg&kind=image
// Returns:
//   uploadUrl — presigned PUT
//   fileUrl   — presigned GET (photos: 1 year, videos: 7 days)
//   videoUrl  — alias of fileUrl (back-compat for exercise uploads)
router.get('/presigned', verifyToken, async (req, res) => {
  try {
    const ext = String(req.query.ext || 'mp4').toLowerCase().replace(/^\./, '');
    const kind = String(req.query.kind || (IMAGE_EXTS.has(ext) ? 'image' : 'video'));
    const isImage = kind === 'image' || IMAGE_EXTS.has(ext);
    const key = `${isImage ? 'photos' : 'videos'}/${randomUUID()}.${ext}`;
    const contentType = contentTypeFor(ext, kind);
    // Videos: the server stores the key and signs playback links per request, so this
    // GET link is only used to identify the object (kept for app back-compat).
    const getExpires = isImage ? 60 * 60 * 24 * 365 : 604800;

    const [uploadUrl, fileUrl] = await Promise.all([
      signedPutUrl(key, contentType),
      signedGetUrl(key, getExpires),
    ]);

    res.json({ uploadUrl, fileUrl, videoUrl: fileUrl, contentType, key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
