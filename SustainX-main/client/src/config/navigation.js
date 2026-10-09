// Central navigation configuration — one source of truth per role.
// Keys map to react-router paths rendered inside each role's AppLayout.

export const NAV_CITIZEN = [
  { to: '/citizen', label: 'Overview', icon: 'dashboard', end: true },
  { to: '/citizen/report', label: 'Report Waste', icon: 'map-pin' },
  { to: '/citizen/complaints', label: 'My Complaints', icon: 'list' },
  { to: '/citizen/bins', label: 'Smart Bins', icon: 'trash' },
  { to: '/citizen/rewards', label: 'Rewards & Store', icon: 'award' },
  { to: '/citizen/notifications', label: 'Notifications', icon: 'bell' },
  { to: '/citizen/profile', label: 'Profile', icon: 'user' },
];

export const NAV_COLLECTOR = [
  { to: '/collector', label: "Today's Overview", icon: 'dashboard', end: true },
  { to: '/collector/tasks', label: 'Collection Tasks', icon: 'clipboard' },
  { to: '/collector/bins', label: 'Smart Bin Alerts', icon: 'trash' },
  { to: '/collector/orders', label: 'Deliveries', icon: 'package' },
  { to: '/collector/profile', label: 'Profile', icon: 'user' },
];

export const NAV_ADMIN = [
  { to: '/admin', label: 'Control Room', icon: 'dashboard', end: true },
  { to: '/admin/operations', label: 'Live Operations', icon: 'activity' },
  { to: '/admin/complaints', label: 'Complaints', icon: 'list' },
  { to: '/admin/bins', label: 'Smart Bins', icon: 'trash' },
  { to: '/admin/wards', label: 'Wards & Zones', icon: 'map' },
  { to: '/admin/vehicles', label: 'Vehicles & Routes', icon: 'truck' },
  { to: '/admin/analytics', label: 'Analytics', icon: 'chart' },
  { to: '/admin/ai', label: 'AI Insights', icon: 'cpu' },
  { to: '/admin/users', label: 'Users', icon: 'users' },
  { to: '/admin/rewards', label: 'Rewards', icon: 'award' },
  { to: '/admin/orders', label: 'Store Orders', icon: 'package' },
  { to: '/admin/profile', label: 'Profile', icon: 'user' },
];

export const NAV_BY_ROLE = {
  student: NAV_CITIZEN,
  collector: NAV_COLLECTOR,
  admin: NAV_ADMIN,
};

export const navForRole = (role) => NAV_BY_ROLE[role] || NAV_CITIZEN;