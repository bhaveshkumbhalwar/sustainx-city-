import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { navForRole } from '../../config/navigation';
import { roleMeta } from '../../config/roles';
import Sidebar from './Sidebar';
import AppTopbar from './AppTopbar';
import MobileNav from './MobileNav';

function useCurrentPage(navItems) {
  const { pathname } = useLocation();
  const match = navItems.find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to)));
  return match ? { title: match.label } : { title: 'Overview' };
}

export default function AppLayout() {
  const { user } = useAuth();
  const navItems = navForRole(user?.role);
  const meta = roleMeta(user?.role);
  const { title } = useCurrentPage(navItems);

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('wms_sidebar') === 'collapsed';
    } catch {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleToggleSidebar = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem('wms_sidebar', c ? 'expanded' : 'collapsed');
      } catch {
        // storage unavailable — preference simply won't persist
      }
      return !c;
    });
  };

  return (
    <div className="app-shell">
      <Sidebar
        navItems={navItems}
        collapsed={collapsed}
        onToggle={handleToggleSidebar}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <div className="app-main">
        <AppTopbar
          title={title}
          subtitle={meta.description}
          onToggleMenu={() => setMobileOpen(true)}
        />
        <main className="app-content">
          <div className="app-content-inner">
            <Outlet />
          </div>
        </main>
      </div>
      <MobileNav items={navItems} />
    </div>
  );
}