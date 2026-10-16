/**
 * Curated hospital affiliations shown in the physio portal.
 * logoKey maps to assets in the patient app + portal /public/hospitals.
 */
const HOSPITALS = [
  {
    id: 'aga_khan',
    logoKey: 'aga_khan',
    name: 'Aga Khan University Hospital',
    branch: 'Stadium Road / Garden',
    address: 'Karachi',
    city: 'Karachi',
    searchHint: 'Aga Khan University Hospital Karachi',
  },
  {
    id: 'ziauddin',
    logoKey: 'ziauddin',
    name: 'Dr Ziauddin Hospital',
    branch: 'Clifton Campus',
    address: 'Karachi',
    city: 'Karachi',
    searchHint: 'Ziauddin Hospital Clifton Karachi',
  },
  {
    id: 'shaukat_khanum',
    logoKey: 'shaukat_khanum',
    name: 'Shaukat Khanum Memorial Cancer Hospital',
    branch: 'Johar Town',
    address: 'Lahore',
    city: 'Lahore',
    searchHint: 'Shaukat Khanum Memorial Hospital Lahore',
  },
  {
    id: 'south_city',
    logoKey: 'south_city',
    name: 'South City Hospital',
    branch: 'Clifton',
    address: 'Karachi',
    city: 'Karachi',
    searchHint: 'South City Hospital Karachi',
  },
  {
    id: 'doctors_hospital',
    logoKey: 'doctors_hospital',
    name: 'Doctors Hospital & Medical Center',
    branch: 'Johar Town',
    address: 'Lahore',
    city: 'Lahore',
    searchHint: 'Doctors Hospital Lahore',
  },
  {
    id: 'national_hospital',
    logoKey: 'national_hospital',
    name: 'National Hospital',
    branch: 'DHA Phase 5',
    address: 'Lahore',
    city: 'Lahore',
    searchHint: 'National Hospital DHA Lahore',
  },
  {
    id: 'pims',
    logoKey: 'pims',
    name: 'PIMS',
    branch: 'G-8/3',
    address: 'Islamabad',
    city: 'Islamabad',
    searchHint: 'Pakistan Institute of Medical Sciences Islamabad',
  },
  {
    id: 'services',
    logoKey: 'services',
    name: 'Services Hospital',
    branch: 'Jail Road',
    address: 'Lahore',
    city: 'Lahore',
    searchHint: 'Services Hospital Lahore',
  },
];

function findHospital(idOrKey) {
  if (!idOrKey) return null;
  const k = String(idOrKey).toLowerCase();
  return HOSPITALS.find(h => h.id === k || h.logoKey === k) || null;
}

function matchHospitalByName(name) {
  if (!name) return null;
  const n = String(name).toLowerCase();
  return (
    HOSPITALS.find(h => n.includes(h.name.toLowerCase().slice(0, 12)) || n.includes(h.id.replace(/_/g, ' '))) ||
    null
  );
}

module.exports = { HOSPITALS, findHospital, matchHospitalByName };
