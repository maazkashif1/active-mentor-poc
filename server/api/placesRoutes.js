const express = require('express');
const verifyToken = require('../middleware/auth');
const { HOSPITALS, findHospital } = require('../data/hospitals');

const router = express.Router();

const PLACES_KEY = () => process.env.GOOGLE_PLACES_API_KEY || '';

async function resolvePlacePhoto(photoName, maxHeightPx = 800) {
  const key = PLACES_KEY();
  if (!key || !photoName) return null;
  const name = photoName.startsWith('places/') ? photoName : photoName;
  const url =
    `https://places.googleapis.com/v1/${name}/media` +
    `?maxHeightPx=${maxHeightPx}&maxWidthPx=${maxHeightPx}&skipHttpRedirect=true`;
  const resp = await fetch(url, { headers: { 'X-Goog-Api-Key': key } });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return null;
  return data.photoUri || null;
}

/** GET /api/places/hospitals — curated list (no Google key needed) */
router.get('/hospitals', verifyToken, (_req, res) => {
  res.json({
    hospitals: HOSPITALS,
    placesEnabled: Boolean(PLACES_KEY()),
  });
});

/** GET /api/places/hospitals/:id */
router.get('/hospitals/:id', verifyToken, (req, res) => {
  const h = findHospital(req.params.id);
  if (!h) return res.status(404).json({ message: 'Hospital not found' });
  res.json({ hospital: h });
});

/**
 * GET /api/places/autocomplete?q=
 * Proxies Google Places API (New). Falls back to curated filter if no key.
 */
router.get('/autocomplete', verifyToken, async (req, res) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return res.json({ suggestions: [], placesEnabled: Boolean(PLACES_KEY()) });

  const key = PLACES_KEY();
  if (!key) {
    const lower = q.toLowerCase();
    const suggestions = HOSPITALS.filter(
      h =>
        h.name.toLowerCase().includes(lower) ||
        h.city.toLowerCase().includes(lower) ||
        h.searchHint.toLowerCase().includes(lower),
    ).map(h => ({
      placeId: null,
      hospitalId: h.id,
      logoKey: h.logoKey,
      name: h.name,
      branch: h.branch,
      address: `${h.branch}, ${h.address}`,
      city: h.city,
      source: 'curated',
    }));
    return res.json({ suggestions, placesEnabled: false });
  }

  try {
    const resp = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
      },
      body: JSON.stringify({
        input: q,
        includedRegionCodes: ['pk'],
        includedPrimaryTypes: ['hospital', 'doctor', 'physiotherapist'],
      }),
    });
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(502).json({ message: data?.error?.message || 'Places autocomplete failed' });
    }

    const suggestions = (data.suggestions || [])
      .map(s => s.placePrediction)
      .filter(Boolean)
      .map(p => ({
        placeId: p.placeId,
        hospitalId: null,
        logoKey: null,
        name: p.structuredFormat?.mainText?.text || p.text?.text || '',
        branch: p.structuredFormat?.secondaryText?.text || '',
        address: p.text?.text || '',
        city: '',
        source: 'places',
      }));

    res.json({ suggestions, placesEnabled: true });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/places/details?placeId=
 * Resolves a Google place into our clinic shape, including a photo when available.
 */
router.get('/details', verifyToken, async (req, res) => {
  const placeId = String(req.query.placeId || '').trim();
  if (!placeId) return res.status(400).json({ message: 'placeId required' });

  const key = PLACES_KEY();
  if (!key) return res.status(503).json({ message: 'GOOGLE_PLACES_API_KEY not configured' });

  try {
    const id = placeId.startsWith('places/') ? placeId : `places/${placeId}`;
    const resp = await fetch(
      `https://places.googleapis.com/v1/${id}?languageCode=en`,
      {
        headers: {
          'X-Goog-Api-Key': key,
          'X-Goog-FieldMask':
            'id,displayName,formattedAddress,shortFormattedAddress,location,addressComponents,photos',
        },
      },
    );
    const data = await resp.json();
    if (!resp.ok) {
      return res.status(502).json({ message: data?.error?.message || 'Places details failed' });
    }

    const comps = data.addressComponents || [];
    const city =
      comps.find(c => c.types?.includes('locality'))?.longText ||
      comps.find(c => c.types?.includes('administrative_area_level_2'))?.longText ||
      '';

    const photoName = data.photos?.[0]?.name || '';
    let photoUrl = '';
    if (photoName) {
      photoUrl = (await resolvePlacePhoto(photoName, 800)) || '';
    }

    // Optional static map preview (needs Maps Static API; ignore failures)
    let mapUrl = '';
    const lat = data.location?.latitude;
    const lng = data.location?.longitude;
    if (lat != null && lng != null) {
      mapUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}&zoom=15&size=640x420&scale=2&maptype=roadmap` +
        `&markers=color:0xDA7235%7C${lat},${lng}&key=${encodeURIComponent(key)}`;
    }

    res.json({
      clinic: {
        name: data.displayName?.text || '',
        branch: data.shortFormattedAddress || '',
        address: data.formattedAddress || city,
        city,
        placeId: data.id || placeId,
        logoKey: '',
        photoName,
        photoUrl,
        mapUrl,
        lat: lat ?? null,
        lng: lng ?? null,
        source: 'places',
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

/**
 * GET /api/places/photo?name=places/.../photos/...
 * Public image proxy so the RN <Image> can load without auth headers.
 * Refreshes Google photoUri on each request.
 */
router.get('/photo', async (req, res) => {
  const name = String(req.query.name || '').trim();
  if (!name || !name.includes('photos/')) {
    return res.status(400).json({ message: 'Valid photo name required' });
  }
  const key = PLACES_KEY();
  if (!key) return res.status(503).json({ message: 'GOOGLE_PLACES_API_KEY not configured' });

  try {
    const max = Math.min(Number(req.query.max || 800) || 800, 1600);
    // Follow redirect and stream bytes
    const url =
      `https://places.googleapis.com/v1/${name}/media` +
      `?maxHeightPx=${max}&maxWidthPx=${max}`;
    const resp = await fetch(url, {
      headers: { 'X-Goog-Api-Key': key },
      redirect: 'follow',
    });
    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).send(err || 'Photo fetch failed');
    }
    const ctype = resp.headers.get('content-type') || 'image/jpeg';
    res.setHeader('Content-Type', ctype);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    const buf = Buffer.from(await resp.arrayBuffer());
    res.send(buf);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;
