import { API_BASE } from '../config/urls';

/** Curated hospital logo keys — keep in sync with server/data/hospitals.js */

const LOGOS: Record<string, any> = {
  aga_khan: require('../assets/images/figma/profile/hospitals/hospital_agakhan.png'),
  ziauddin: require('../assets/images/figma/profile/hospitals/hospital_ziauddin.png'),
  shaukat_khanum: require('../assets/images/figma/profile/hospitals/hospital_shaukat.jpg'),
  south_city: require('../assets/images/figma/profile/hospitals/hospital_southcity.jpg'),
  doctors_hospital: require('../assets/images/figma/profile/hospitals/hospital_doctors.jpg'),
  national_hospital: require('../assets/images/figma/profile/hospitals/hospital_national.jpg'),
  pims: require('../assets/images/figma/profile/hospitals/hospital_pims.jpg'),
  services: require('../assets/images/figma/profile/hospitals/hospital_services.jpg'),
};

const NAME_HINTS: { key: string; needles: string[] }[] = [
  { key: 'aga_khan', needles: ['aga khan', 'akuh'] },
  { key: 'ziauddin', needles: ['ziauddin'] },
  { key: 'shaukat_khanum', needles: ['shaukat', 'khanum'] },
  { key: 'south_city', needles: ['south city'] },
  { key: 'doctors_hospital', needles: ['doctors hospital'] },
  { key: 'national_hospital', needles: ['national hospital'] },
  { key: 'pims', needles: ['pims', 'pakistan institute of medical'] },
  { key: 'services', needles: ['services hospital'] },
];

export function hospitalLogoSource(clinicOrKey?: {
  logoKey?: string;
  name?: string;
} | string | null) {
  if (!clinicOrKey) return null;
  if (typeof clinicOrKey === 'string') return LOGOS[clinicOrKey] || null;
  if (clinicOrKey.logoKey && LOGOS[clinicOrKey.logoKey]) return LOGOS[clinicOrKey.logoKey];
  const name = (clinicOrKey.name || '').toLowerCase();
  for (const { key, needles } of NAME_HINTS) {
    if (needles.some(n => name.includes(n))) return LOGOS[key];
  }
  return null;
}

/** Image for a clinic row: Places photo → curated logo → null */
export function clinicImageSource(clinic?: {
  logoKey?: string;
  name?: string;
  photoUrl?: string;
  photoName?: string;
} | null) {
  if (!clinic) return null;
  if (clinic.photoUrl) return { uri: clinic.photoUrl };
  if (clinic.photoName) {
    return {
      uri: `${API_BASE}/places/photo?name=${encodeURIComponent(clinic.photoName)}&max=800`,
    };
  }
  return hospitalLogoSource(clinic);
}

export function clinicMapSource(clinic?: { mapUrl?: string; lat?: number | null; lng?: number | null } | null) {
  if (clinic?.mapUrl) return { uri: clinic.mapUrl };
  return null;
}

export function hospitalLogoKeys() {
  return Object.keys(LOGOS);
}
