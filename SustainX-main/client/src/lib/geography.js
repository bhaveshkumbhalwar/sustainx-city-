// City-scale geography mapping.
//
// The backend stores geographic scope as "block" (A–E). We do NOT rename any
// API field. Instead we present each block as an operational Ward and give it a
// configurable display name in ONE place. Adding more wards/zones later only
// requires editing this file — no UI or service changes.
//
// Hierarchy presented to the user:
//   City → Zone → Ward → Area → Collection Point → Smart Bin

export const CITY_CONFIG = {
  name: 'City',
  hierarchy: ['City', 'Zone', 'Ward', 'Area', 'Collection Point', 'Smart Bin'],
};

// Configured wards. code === backend block value (must stay A–E today).
export const WARD_CONFIG = [
  { code: 'A', name: 'Ward A', zone: 'Zone 1' },
  { code: 'B', name: 'Ward B', zone: 'Zone 1' },
  { code: 'C', name: 'Ward C', zone: 'Zone 2' },
  { code: 'D', name: 'Ward D', zone: 'Zone 2' },
  { code: 'E', name: 'Ward E', zone: 'Zone 3' },
];

export const wards = () => WARD_CONFIG;
export const zones = () => {
  const seen = [];
  WARD_CONFIG.forEach((w) => {
    if (!seen.some((z) => z.name === w.zone)) seen.push({ name: w.zone });
  });
  return seen;
};

export const wardByCode = (code) =>
  WARD_CONFIG.find((w) => w.code === String(code).toUpperCase() || null);

// Human label for backend "block" values.
export const wardLabel = (code) => {
  if (!code) return 'City';

  // No need to know the full code: any block maps to a configured ward.
  const w = wardByCode(code);
  if (w) return w.name;

  // Fallback for codes not yet configured — never invent names.
  return `Ward ${String(code).toUpperCase()}`;
};

export const zoneOf = (code) => {
  const w = wardByCode(code);
  return w ? w.zone : 'City-wide';
};