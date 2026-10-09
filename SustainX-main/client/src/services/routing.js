// Route-planning foundation (§41–43).
//
// There is deliberately NO route optimization here: the backend exposes no
// routing endpoint, and inventing optimized routes would be fake data.
// This module defines the integration contract so a future optimizer
// (OSRM / GraphHopper / custom service, behind a backend endpoint) can plug
// in without touching callers.
//
// Route data model (target shape):
// {
//   routeId, vehicle, collector, ward, stops: [{ binId|taskId, lat, lng, kind }],
//   distanceKm, estimatedMinutes, status, createdAt
// }

export const ROUTE_STATUS = 'NOT_AVAILABLE';

export function routeCapability() {
  return {
    status: ROUTE_STATUS,
    message: 'Route optimization unavailable — no routing endpoint on the backend yet.',
    integrationReady: true,
    modelBacked: false,
  };
}

// Future entry point. Resolves with { status: 'NOT_AVAILABLE', ... } until a
// backend optimizer exists. Callers must handle NOT_AVAILABLE explicitly.
export async function optimizeRoute() {
  return {
    status: ROUTE_STATUS,
    route: null,
    message: 'Route optimization unavailable — no routing endpoint on the backend yet.',
  };
}

// Client-side stop ordering is intentionally NOT provided: naive ordering
// would masquerade as optimization. Stops are listed in input order only.
export function listStopsInInputOrder(stops) {
  return [...(stops || [])];
}
