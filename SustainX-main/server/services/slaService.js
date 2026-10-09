const HOURS = (n) => n * 60 * 60 * 1000;

const DEFAULT_SLA = Object.freeze({
  critical: HOURS(2),
  high: HOURS(8),
  medium: HOURS(24),
  low: HOURS(48),
});

// Env override format: SLA_POLICIES='{"low":48,"medium":24,"high":8,"critical":2}'
let SLA_POLICIES = DEFAULT_SLA;
if (process.env.SLA_POLICIES) {
  try {
    const parsed = JSON.parse(process.env.SLA_POLICIES);
    SLA_POLICIES = Object.freeze({
      critical: HOURS(parsed.critical ?? 2),
      high: HOURS(parsed.high ?? 8),
      medium: HOURS(parsed.medium ?? 24),
      low: HOURS(parsed.low ?? 48),
    });
  } catch (err) {
    console.error('[SLA] Invalid SLA_POLICIES env var, using defaults:', err.message);
  }
}

const slaDeadlineFor = (priority) =>
  new Date(Date.now() + (SLA_POLICIES[priority] ?? SLA_POLICIES.low));

const remainingMsFor = (deadline) =>
  deadline ? Math.max(0, new Date(deadline).getTime() - Date.now()) : null;

const isBreached = (deadline) =>
  !!deadline && new Date(deadline).getTime() < Date.now();

const escalateIfBreached = (complaint) => {
  if (
    complaint.slaDeadline &&
    isBreached(complaint.slaDeadline) &&
    complaint.status !== 'completed' &&
    complaint.status !== 'rejected' &&
    complaint.status !== 'citizen_confirmed'
  ) {
    complaint.slaBreached = true;
  }
  return complaint;
};

module.exports = { SLA_POLICIES, slaDeadlineFor, remainingMsFor, isBreached, escalateIfBreached };