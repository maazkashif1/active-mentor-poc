/** Local stand-ins when a physiologist has no uploaded photo. */
const PLACEHOLDERS = [
  require('../assets/images/figma/physio_ahmed.png'),
  require('../assets/images/figma/physio_sania.png'),
  require('../assets/images/figma/profile/doctor_hero.png'),
];

function hashId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable placeholder for a physio id (or name) so list + profile match. */
export function physioPlaceholder(physioOrId?: { _id?: string; id?: string; name?: string } | string | null) {
  if (physioOrId == null) return PLACEHOLDERS[0];
  const key =
    typeof physioOrId === 'string'
      ? physioOrId
      : String(physioOrId._id || physioOrId.id || physioOrId.name || '0');
  return PLACEHOLDERS[hashId(key) % PLACEHOLDERS.length];
}

export function physioPhotoSource(physio: any) {
  if (physio?.photo) return { uri: physio.photo };
  if (physio?.localPhoto) return physio.localPhoto;
  return physioPlaceholder(physio);
}
