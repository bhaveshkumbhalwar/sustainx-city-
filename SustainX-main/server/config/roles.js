// Canonical roles stored in the database. The platform preserves these
// exact values for backward compatibility with existing clients while the
// city-scale aliases let the backend grow a municipal hierarchy.
const ROLE_LEVELS = {
  student: 1,
  collector: 2,
  admin: 3,
};

const ROLE_LABELS = {
  student: 'Citizen',
  collector: 'Field Collection Officer',
  admin: 'Municipal Administrator',
};

const ROLE_ALIASES = {
  citizen: 'student',
  'field_officer': 'collector',
  'field-officer': 'collector',
  'municipal_admin': 'admin',
  'municipal-admin': 'admin',
  operator: 'collector',
  moderator: 'collector',
};

const normalizeRole = (role) => {
  if (!role) return null;
  if (ROLE_LEVELS[role]) return role;
  if (ROLE_ALIASES[role]) return ROLE_ALIASES[role];
  return null;
};

module.exports = { ROLE_LEVELS, ROLE_LABELS, ROLE_ALIASES, normalizeRole };
