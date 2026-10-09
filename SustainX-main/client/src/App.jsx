import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { rolePath } from './config/roles';
import PublicLayout from './components/layout/PublicLayout';
import AppLayout from './components/layout/AppLayout';
import Landing from './pages/public/Landing';
import AuthPage from './pages/auth/AuthPage';
// Citizen
import CitizenDashboard from './pages/citizen/CitizenDashboard';
import ReportWaste from './pages/citizen/ReportWaste';
import MyComplaints from './pages/citizen/MyComplaints';
import NearbyBins from './pages/citizen/NearbyBins';
import RewardsStore from './pages/citizen/RewardsStore';
import NotificationsPage from './pages/citizen/NotificationsPage';
import CitizenProfile from './pages/citizen/CitizenProfile';
// Collector
import CollectorHome from './pages/collector/CollectorHome';
import CollectorTasks from './pages/collector/CollectorTasks';
import CollectorBins from './pages/collector/CollectorBins';
import CollectorOrders from './pages/collector/CollectorOrders';
import CollectorProfile from './pages/collector/CollectorProfile';
// Admin
import ControlRoom from './pages/admin/ControlRoom';
import LiveOperations from './pages/admin/LiveOperations';
import AdminComplaints from './pages/admin/AdminComplaints';
import AdminBins from './pages/admin/AdminBins';
import BinDetail from './pages/admin/BinDetail';
import AdminWards from './pages/admin/AdminWards';
import AdminVehicles from './pages/admin/AdminVehicles';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminAi from './pages/admin/AdminAi';
import AdminUsers from './pages/admin/AdminUsers';
import AdminRewards from './pages/admin/AdminRewards';
import AdminOrders from './pages/admin/AdminOrders';
import AdminProfile from './pages/admin/AdminProfile';

function ProtectedRoute({ children, allowedRole }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-boot-screen"><div className="app-boot-spinner" /></div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to={rolePath(user.role)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-boot-screen"><div className="app-boot-spinner" /></div>;
  return user ? <Navigate to={rolePath(user.role)} replace /> : <Landing />;
}

function LoginRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="app-boot-screen"><div className="app-boot-spinner" /></div>;
  if (user) return <Navigate to={rolePath(user.role)} replace />;
  return <AuthPage />;
}

function App() {
  const { loading, sessionKey } = useAuth();
  if (loading) return <div className="app-boot-screen"><div className="app-boot-spinner" /></div>;

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<HomeRedirect />} />
        </Route>
        <Route path="/login" element={<LoginRoute />} />

        {/* ── Citizen (student) ── */}
        <Route
          path="/citizen"
          element={
            <ProtectedRoute allowedRole="student">
              <AppLayout key={`citizen-${sessionKey}`} />
            </ProtectedRoute>
          }
        >
          <Route index element={<CitizenDashboard />} />
          <Route path="report" element={<ReportWaste />} />
          <Route path="complaints" element={<MyComplaints />} />
          <Route path="bins" element={<NearbyBins />} />
          <Route path="rewards" element={<RewardsStore />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="profile" element={<CitizenProfile />} />
        </Route>

        {/* ── Collector ── */}
        <Route
          path="/collector"
          element={
            <ProtectedRoute allowedRole="collector">
              <AppLayout key={`collector-${sessionKey}`} />
            </ProtectedRoute>
          }
        >
          <Route index element={<CollectorHome />} />
          <Route path="tasks" element={<CollectorTasks />} />
          <Route path="bins" element={<CollectorBins />} />
          <Route path="orders" element={<CollectorOrders />} />
          <Route path="profile" element={<CollectorProfile />} />
        </Route>

        {/* ── Municipal Admin ── */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRole="admin">
              <AppLayout key={`admin-${sessionKey}`} />
            </ProtectedRoute>
          }
        >
          <Route index element={<ControlRoom />} />
          <Route path="operations" element={<LiveOperations />} />
          <Route path="complaints" element={<AdminComplaints />} />
          <Route path="bins" element={<AdminBins />} />
          <Route path="bins/:binId" element={<BinDetail />} />
          <Route path="wards" element={<AdminWards />} />
          <Route path="vehicles" element={<AdminVehicles />} />
          <Route path="analytics" element={<AdminAnalytics />} />
          <Route path="ai" element={<AdminAi />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="rewards" element={<AdminRewards />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="profile" element={<AdminProfile />} />
        </Route>

        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;