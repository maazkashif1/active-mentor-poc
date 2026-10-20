// Cloudflare R2 (S3-compatible) client + helpers shared by uploads and video playback.
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const s3 = new S3Client({
  region: process.env.R2_REGION ?? 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY ?? '',
  },
});

const bucket = () => process.env.R2_BUCKET;

// Short-lived read link, generated on demand (never stored).
function signedGetUrl(key, expiresIn = 6 * 60 * 60) {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket(), Key: key }), { expiresIn });
}

function signedPutUrl(key, contentType, expiresIn = 300) {
  return getSignedUrl(s3, new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }), { expiresIn });
}

// Object key from a (possibly expired) presigned URL. Handles virtual-hosted
// (bucket.<account>.r2...) and path-style (<endpoint>/<bucket>/key) URLs.
function keyFromUrl(url) {
  if (!url) return null;
  try {
    let path = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, '');
    const b = bucket();
    if (b && path.startsWith(`${b}/`)) path = path.slice(b.length + 1);
    return path || null;
  } catch {
    return null;
  }
}

module.exports = { s3, bucket, signedGetUrl, signedPutUrl, keyFromUrl };
