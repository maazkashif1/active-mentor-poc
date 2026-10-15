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

// GET /api/upload/presigned?ext=mp4
// Returns:
//   uploadUrl — presigned PUT (expires in 5 min), used by the app to upload
//   videoUrl  — presigned GET (expires in 7 days), stored on the result and
//               played directly by the portal without needing a public bucket
router.get('/presigned', verifyToken, async (req, res) => {
  try {
    const ext = req.query.ext ?? 'mp4';
    const key = `videos/${randomUUID()}.${ext}`;
    const bucket = process.env.R2_BUCKET;

    const [uploadUrl, videoUrl] = await Promise.all([
      getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: `video/${ext}` }), { expiresIn: 300 }),
      getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 604800 }),
    ]);

    res.json({ uploadUrl, videoUrl });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
