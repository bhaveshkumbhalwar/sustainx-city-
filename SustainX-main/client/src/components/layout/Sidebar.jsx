import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleMeta } from '../../config/roles';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

export default function Sidebar({ navItems, collapsed, onToggle, open, onClose }) {
  const { user, logout } = useAuth();
  const meta = roleMeta(user?.role);

  return (
    <>
      <div className={`sidebar-overlay2 ${open ? 'open' : ''}`} onClick={onClose} aria-hidden="true" />
      <aside className={`app-sidebar ${collapsed ? 'collapsed' : ''} ${open ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">
            <Icon name="recycle" size={22} />
          </div>
          {!collapsed && (
            <div className="brand-text">
              <span className="brand-eyebrow">Municipal Corporation</span>
              <div className="brand-name">SustainX</div>
              <div className="brand-tagline">{meta.label} · Waste Division</div>
            </div>
          )}
          <button className="sidebar-col-btn" onClick={onToggle} aria-label={collapsed ? 'Expand menu' : 'Collapse menu'}>
            <Icon name={collapsed ? 'chevronRight' : 'chevronLeft'} size={18} />
          </button>
          <button className="sidebar-close-mobile" onClick={onClose} aria-label="Close menu">
            <Icon name="close" size={18} />
          </button>
        </div>

        {!collapsed && (
          <div className="sidebar-scope">
            <span className="scope-label">Municipal Scope</span>
            <span className="scope-value">City-wide Operations</span>
          </div>
        )}

        <nav className="app-sidebar-nav" aria-label={meta.label}>
          <span className="nav-group-label">{collapsed ? '' : 'Menu'}</span>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onClose}
              className={({ isActive }) => `app-nav-item ${isActive ? 'active' : ''}`}
              title={item.label}
            >
              <span className="app-nav-icon">
                <Icon name={item.icon} size={19} />
              </span>
              {!collapsed && <span className="app-nav-label">{item.label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="app-sidebar-footer">
          <div className="sidebar-user" title={user?.name}>
            <Avatar name={user?.name} size={38} />
            {!collapsed && (
              <div className="sidebar-user-meta">
                <div className="sidebar-user-name">{user?.name}</div>
                <div className="sidebar-user-role">{meta.roleName}</div>
              </div>
            )}
          </div>
          {!collapsed && (
            <button className="btn btn-ghost btn-sm btn-full logout-btn" onClick={logout} type="button">
              <Icon name="logout" size={15} /> Sign out
            </button>
          )}
          {!collapsed && (
            <div className="sidebar-gov">Secure &amp; Encrypted · Official Government Portal</div>
          )}
        </div>
      </aside>
    </>
  );
}