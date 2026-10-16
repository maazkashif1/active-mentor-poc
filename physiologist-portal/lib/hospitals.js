/** Logo paths served from /public/hospitals — keys match server/data/hospitals.js */

export const HOSPITAL_LOGOS = {
  aga_khan: '/hospitals/hospital_agakhan.png',
  ziauddin: '/hospitals/hospital_ziauddin.png',
  shaukat_khanum: '/hospitals/hospital_shaukat.jpg',
  south_city: '/hospitals/hospital_southcity.jpg',
  doctors_hospital: '/hospitals/hospital_doctors.jpg',
  national_hospital: '/hospitals/hospital_national.jpg',
  pims: '/hospitals/hospital_pims.jpg',
  services: '/hospitals/hospital_services.jpg',
};

export function logoUrl(logoKey) {
  return (logoKey && HOSPITAL_LOGOS[logoKey]) || null;
}
