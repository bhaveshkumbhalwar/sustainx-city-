// Role → product identity mapping.
// Backend roles are preserved verbatim (student/collector/admin).
// These keys drive navigation, shell names and UI labels only.
export const ROLE_META = {
  student: {
    key: 'student',
    path: '/citizen',
    label: 'Citizen',
    heading: 'Citizen Services',
    roleName: 'Citizen',
    description: 'Report waste, track complaints and earn rewards',
    sidebarIcon: 'home',
  },
  collector: {
    key: 'collector',
    path: '/collector',
    label: 'Collector',
    heading: 'Field Operations',
    roleName: 'Collection Officer',
    description: 'Collection tasks, bin alerts and proof of collection',
    sidebarIcon: 'truck',
  },
  admin: {
    key: 'admin',
    path: '/admin',
    label: 'Municipal Admin',
    heading: 'Municipal Control Room',
    roleName: 'Municipal Administrator',
    description: 'City-wide operations, analytics and management',
    sidebarIcon: 'shield',
  },
};

export const roleMeta = (role) => ROLE_META[role] || ROLE_META.student;
export const rolePath = (role) => (ROLE_META[role] ? ROLE_META[role].path : '/');