import axios from 'axios';

// ✅ Use Vite environment variable (public config only — never secrets)
const baseURL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api`
  : '/api';

const TOKEN_KEY = 'wms_token';

export const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setToken = (token) => {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // storage unavailable — requests simply go out unauthenticated
  }
};

// ──────────────────────────────────────────────────────────────
// Normalized API error — UI components consume this shape only.
// { message, code, status } — never raw axios errors in JSX.
// ──────────────────────────────────────────────────────────────
export class ApiError extends Error {
  constructor(message, { code = 'UNKNOWN', status = 0 } = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

const FRIENDLY_BY_STATUS = {
  400: 'The request was invalid. Please check your input.',
  401: 'Your session has expired. Please sign in again.',
  403: "You don't have permission to perform this action.",
  404: 'The requested item could not be found.',
  409: 'This action conflicts with the current state. Please refresh and try again.',
  413: 'Image must be smaller than 5MB.',
  429: 'Too many requests. Please wait a moment and try again.',
  500: 'Something went wrong on the server. Please try again.',
};

function normalizeError(error) {
  if (error instanceof ApiError) return error;
  const status = error?.response?.status || 0;
  const backendMessage = error?.response?.data?.message;
  // Prefer the backend's specific message when it is a client error;
  // fall back to friendly copy. Never surface stack traces.
  const message =
    (status >= 400 && status < 500 && backendMessage) ||
    FRIENDLY_BY_STATUS[status] ||
    backendMessage ||
    'Network error. Please check your connection and try again.';
  const code =
    status === 401 ? 'UNAUTHORIZED'
    : status === 403 ? 'FORBIDDEN'
    : status === 404 ? 'NOT_FOUND'
    : status === 409 ? 'CONFLICT'
    : status === 413 ? 'PAYLOAD_TOO_LARGE'
    : status === 429 ? 'RATE_LIMITED'
    : status >= 500 ? 'SERVER_ERROR'
    : status === 0 ? 'NETWORK_ERROR'
    : 'REQUEST_FAILED';
  return new ApiError(message, { code, status });
}

const API = axios.create({
  baseURL,
  timeout: 30000,
});

// ✅ Attach token to every request (single place — never in components)
API.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ✅ Central 401 handling: clear invalid auth, redirect to login once.
// Never redirect when already on /login or / (no loop). 403 is surfaced,
// never treated as logged-out.
let redirectingToLogin = false;
API.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const url = error?.config?.url || '';
    const isAuthCall = url.includes('/auth/login') || url.includes('/auth/register');
    if (status === 401 && !isAuthCall && typeof window !== 'undefined') {
      setToken(null);
      const path = window.location.pathname;
      if (path !== '/login' && path !== '/' && !redirectingToLogin) {
        redirectingToLogin = true;
        window.location.assign('/login');
        setTimeout(() => { redirectingToLogin = false; }, 2000);
      }
    }
    return Promise.reject(normalizeError(error));
  },
);

// ================= AUTH =================
export const loginUser = (data) => API.post('/auth/login', data);
export const registerUser = (data) => API.post('/auth/register', data);
export const getMe = () => API.get('/auth/me');
export const forgotPasswordApi = (data) => API.post('/auth/forgot-password', data);

// ================= USERS =================
export const getUsers = (role) =>
  API.get('/users', { params: role ? { role } : {} });

export const getUserById = (id) => API.get(`/users/${id}`);
export const createUser = (data) => API.post('/users', data);
export const updateUser = (id, data) => API.put(`/users/${id}`, data);
export const changePassword = (id, data) =>
  API.put(`/users/${id}/password`, data);
export const deleteUserApi = (id) => API.delete(`/users/${id}`);

// ================= COMPLAINTS =================
export const getComplaints = (params) =>
  API.get('/complaints', { params });

export const getComplaintById = (id) =>
  API.get(`/complaints/${id}`);

export const submitComplaint = (data) => API.post('/complaints', data);

export const updateComplaintStatus = (id, data) =>
  API.put(`/complaints/${id}/status`, data);

export const completeComplaintApi = (id, data) =>
  API.post(`/complaints/complete/${id}`, data);

export const confirmComplaintApi = (id) =>
  API.post(`/complaints/${id}/confirm`);

export const reopenComplaintApi = (id) =>
  API.post(`/complaints/${id}/reopen`);

// ================= COLLECTION TASKS =================
export const getTasks = (params) => API.get('/tasks', { params });
export const getTaskById = (id) => API.get(`/tasks/${id}`);
export const createTaskApi = (data) => API.post('/tasks', data);
export const assignTaskApi = (id, worker) => API.post(`/tasks/${id}/assign`, { worker });
export const acceptTaskApi = (id) => API.post(`/tasks/${id}/accept`);
export const startTaskApi = (id) => API.post(`/tasks/${id}/start`);
export const completeTaskApi = (id, data) => API.post(`/tasks/${id}/complete`, data);
export const cancelTaskApi = (id, data) => API.post(`/tasks/${id}/cancel`, data || {});

// ================= REWARDS =================
export const getRewards = (params) =>
  API.get('/rewards', { params });

export const addReward = (data) =>
  API.post('/rewards', data);

// ================= STATS =================
export const getDashboardStats = () =>
  API.get('/stats/dashboard');

// ================= STORE =================
export const getStoreItems = () => API.get('/store');
export const createStoreItemApi = (data) => API.post('/store', data);

export const redeemStoreItem = (itemId) =>
  API.post('/store/redeem', { itemId });

// ================= ORDERS =================
export const getOrders = (params) =>
  API.get('/orders', { params });

export const getOrderById = (id) =>
  API.get(`/orders/${id}`);

export const updateOrderStatus = (id, data) =>
  API.put(`/orders/${id}`, data);

export const assignOrderApi = (id) =>
  API.post(`/orders/assign/${id}`);

// ================= NOTIFICATIONS =================
export const getNotifications = (params) => API.get('/notifications', { params });
export const getUnreadCount = () => API.get('/notifications/unread-count');
export const markNotificationRead = (id) => API.put(`/notifications/read/${id}`);
export const markAllNotificationsRead = () => API.put('/notifications/read-all');

// ================= SMART BINS =================
export const getBins = (params) => API.get('/bins', { params });
export const getBinById = (id) => API.get(`/bins/${id}`);
export const createBinApi = (data) => API.post('/bins', data);
export const updateBinApi = (id, data) => API.put(`/bins/${id}`, data);
export const deleteBinApi = (id) => API.delete(`/bins/${id}`);

// ================= IOT (read-only display — never device credentials) =================
export const getIotBinData = (params) => API.get('/iot/data', { params });
export const getBinReadings = (params) => API.get('/iot/readings', { params });

// ================= DEVICES (admin registry — hashes never leave the server) =================
export const getDevices = (params) => API.get('/devices', { params });
export const setDeviceEnabled = (id, enabled) => API.put(`/devices/${id}`, { enabled });

// ================= VEHICLES =================
export const getVehicles = (params) => API.get('/vehicles', { params });
export const getVehicleById = (id) => API.get(`/vehicles/${id}`);
export const getVehicleHistory = (id, params) => API.get(`/vehicles/${id}/history`, { params });
export const createVehicleApi = (data) => API.post('/vehicles', data);
export const updateVehicleApi = (id, data) => API.put(`/vehicles/${id}`, data);
export const deleteVehicleApi = (id) => API.delete(`/vehicles/${id}`);
export const updateVehicleLocationApi = (id, data) => API.put(`/vehicles/${id}/location`, data);

// ================= GIS =================
export const getNearbyBins = (params) => API.get('/gis/nearby-bins', { params });
export const getNearbyComplaints = (params) => API.get('/gis/nearby-complaints', { params });

// ================= LOCALITIES (City → Zone → Ward → Area) =================
export const getLocalities = () => API.get('/localities');
export const createCityApi = (data) => API.post('/localities/cities', data);
export const updateCityApi = (id, data) => API.put(`/localities/cities/${id}`, data);
export const deleteCityApi = (id) => API.delete(`/localities/cities/${id}`);
export const createZoneApi = (data) => API.post('/localities/zones', data);
export const updateZoneApi = (id, data) => API.put(`/localities/zones/${id}`, data);
export const deleteZoneApi = (id) => API.delete(`/localities/zones/${id}`);
export const createWardApi = (data) => API.post('/localities/wards', data);
export const updateWardApi = (id, data) => API.put(`/localities/wards/${id}`, data);
export const deleteWardApi = (id) => API.delete(`/localities/wards/${id}`);
export const createAreaApi = (data) => API.post('/localities/areas', data);
export const deleteAreaApi = (id) => API.delete(`/localities/areas/${id}`);

// ================= ANALYTICS =================
export const getAnalyticsOverview = () => API.get('/analytics/overview');
export const getWardPerformance = () => API.get('/analytics/ward-performance');
export const getSlaCompliance = () => API.get('/analytics/sla-compliance');
export const getResolutionTime = () => API.get('/analytics/resolution-time');
export const getBinUtilization = () => API.get('/analytics/bin-utilization');
export const getHotspots = () => API.get('/analytics/hotspots');

// ================= AI (capabilities honest; predictions labeled) =================
export const getAiCapabilities = () => API.get('/ai/capabilities');
export const getAiInsights = (params) => API.get('/ai/insights', { params });
export const runAiInsights = (params) => API.post('/ai/insights/run', null, { params });
export const getBinFillEstimate = (binId) => API.get(`/ai/bins/${encodeURIComponent(binId)}/fill-estimate`);

// ================= AUDIT =================
export const getAuditLogs = (params) => API.get('/audit', { params });

export default API;
