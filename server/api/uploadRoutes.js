const express = require('express');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const { randomUUID } = require('crypto');
const verifyToken = require('../middleware/auth');

const router = express.Router();

const s3 = new S3Client({
  region: process.env.R2_REGION ?? 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

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
    const bucket = process.env.R2_BUCKET;
    const contentType = contentTypeFor(ext, kind);
    const getExpires = isImage ? 60 * 60 * 24 * 365 : 604800;

    const [uploadUrl, fileUrl] = await Promise.all([
      getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }),
        { expiresIn: 300 },
      ),
      getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket, Key: key }),
        { expiresIn: getExpires },
      ),
    ]);

    res.json({ uploadUrl, fileUrl, videoUrl: fileUrl, contentType, key });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
