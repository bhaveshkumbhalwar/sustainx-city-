const isObjectId = (v) => /^[0-9a-fA-F]{24}$/.test(String(v || ''));
const isLat = (v) => typeof v === 'number' && !Number.isNaN(v) && v >= -90 && v <= 90;
const isLng = (v) => typeof v === 'number' && !Number.isNaN(v) && v >= -180 && v <= 180;
const inRange = (v, min, max) => typeof v === 'number' && !Number.isNaN(v) && v >= min && v <= max;
const oneOf = (v, list) => Array.isArray(list) && list.includes(v);
const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
const maxLen = (v, n) => !v || String(v).length <= n;
const toNumeric = (v) => {
  if (v === null || v === undefined || v === '') return null;
  return Number(v);
};

// Sanitize a query-string value to a safe primitive (string/number/boolean/null).
// Strips $ operators, nested objects, and arrays to prevent NoSQL injection.
const sanitizeQuery = (v) => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === 'string') {
    const trimmed = v.trim();
    if (trimmed === '') return undefined;
    if (trimmed.startsWith('$')) return undefined;
    return trimmed;
  }
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'boolean') return v;
  return undefined;
};

module.exports = { isObjectId, isLat, isLng, inRange, oneOf, nonEmpty, maxLen, toNumeric, sanitizeQuery };