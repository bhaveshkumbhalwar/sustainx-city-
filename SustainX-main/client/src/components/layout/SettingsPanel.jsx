import { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { rolePath, roleMeta } from '../../config/roles';
import Icon from '../ui/Icon';
import Avatar from '../ui/Avatar';

const SECTIONS = [
  { key: 'appearance', label: 'Appearance', icon: 'sun' },
  { key: 'navigation', label: 'Navigation', icon: 'menu' },
  { key: 'account', label: 'Account', icon: 'user' },
];

const readSidebarPref = () => {
  try {
    return localStorage.getItem('wms_sidebar') === 'collapsed' ? 'collapsed' : 'expanded';
  } catch {
    return 'expanded';
  }
};

export default function SettingsPanel({ onClose }) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const meta = roleMeta(user?.role);
  const [section, setSection] = useState('appearance');
  const [sidebarPref, setSidebarPref] = useState(readSidebarPref);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const applySidebarPref = (value) => {
    setSidebarPref(value);
    try {
      localStorage.setItem('wms_sidebar', value);
    } catch {
      // storage unavailable — applies for this session only
    }
  };

  const handleReset = () => {
    if (section === 'appearance') setTheme('light');
    if (section === 'navigation') applySidebarPref('expanded');
  };

  const profileTo = `${rolePath(user?.role)}/profile`;

  return (
    <div className="settings-overlay" onClick={onClose} role="presentation">
      <div
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        onClick={(e) => e.stopPropagation()}
      >
        <aside className="settings-side">
          <div className="settings-side-title">Settings</div>
          <nav className="settings-nav" aria-label="Settings sections">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                className={`settings-nav-item ${section === s.key ? 'active' : ''}`}
                onClick={() => setSection(s.key)}
                aria-current={section === s.key ? 'true' : undefined}
              >
                <Icon name={s.icon} size={17} />
                {s.label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="settings-main">
          <div className="settings-main-head">
            <h2 className="settings-main-title">
              {SECTIONS.find((s) => s.key === section)?.label}
            </h2>
            <div className="settings-head-actions">
              {section !== 'account' && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={handleReset}>
                  Reset
                </button>
              )}
              <button type="button" className="settings-close" onClick={onClose} aria-label="Close settings">
                <Icon name="close" size={18} />
              </button>
            </div>
          </div>

          {section === 'appearance' && (
            <div className="settings-section">
              <p className="settings-section-desc">Choose how SustainX looks on this device.</p>
              <div className="settings-theme-grid">
                <button
                  type="button"
                  className={`theme-pick ${theme !== 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('light')}
                  aria-pressed={theme !== 'dark'}
                >
                  <span className="theme-preview theme-preview-light" aria-hidden="true">
                    <span className="theme-preview-bar" />
                    <span className="theme-preview-body" />
                  </span>
                  <span className="theme-pick-label">Light</span>
                </button>
                <button
                  type="button"
                  className={`theme-pick ${theme === 'dark' ? 'active' : ''}`}
                  onClick={() => setTheme('dark')}
                  aria-pressed={theme === 'dark'}
                >
                  <span className="theme-preview theme-preview-dark" aria-hidden="true">
                    <span className="theme-preview-bar" />
                    <span className="theme-preview-body" />
                  </span>
                  <span className="theme-pick-label">Dark</span>
                </button>
              </div>
            </div>
          )}

          {section === 'navigation' && (
            <div className="settings-section">
              <p className="settings-section-desc">Default sidebar width when you sign in on this device.</p>
              <button
                type="button"
                className={`settings-radio ${sidebarPref === 'expanded' ? 'active' : ''}`}
                onClick={() => applySidebarPref('expanded')}
                aria-pressed={sidebarPref === 'expanded'}
              >
                <span className="settings-radio-dot" aria-hidden="true" />
                <span className="settings-item-text">
                  <span className="settings-item-title">Expanded</span>
                  <span className="settings-item-desc">Full labels, recommended for desktop</span>
                </span>
              </button>
              <button
                type="button"
                className={`settings-radio ${sidebarPref === 'collapsed' ? 'active' : ''}`}
                onClick={() => applySidebarPref('collapsed')}
                aria-pressed={sidebarPref === 'collapsed'}
              >
                <span className="settings-radio-dot" aria-hidden="true" />
                <span className="settings-item-text">
                  <span className="settings-item-title">Collapsed</span>
                  <span className="settings-item-desc">Icons only, more room for content</span>
                </span>
              </button>
            </div>
          )}

          {section === 'account' && (
            <div className="settings-section">
              <div className="settings-account-card">
                <Avatar name={user?.name} size={48} />
                <div className="settings-item-text">
                  <span className="settings-item-title">{user?.name}</span>
                  <span className="settings-item-desc">{user?.email}</span>
                  <span className="settings-item-desc">{meta.roleName} · Ward {user?.ward || user?.block || '—'}</span>
                </div>
              </div>
              <NavLink to={profileTo} className="settings-radio" onClick={onClose}>
                <span className="settings-radio-dot settings-radio-icon" aria-hidden="true">
                  <Icon name="user" size={15} />
                </span>
                <span className="settings-item-text">
                  <span className="settings-item-title">Profile</span>
                  <span className="settings-item-desc">Edit name, password and ward</span>
                </span>
              </NavLink>
              <button type="button" className="settings-radio settings-signout" onClick={logout}>
                <span className="settings-radio-dot settings-radio-icon" aria-hidden="true">
                  <Icon name="logout" size={15} />
                </span>
                <span className="settings-item-text">
                  <span className="settings-item-title">Sign out</span>
                  <span className="settings-item-desc">End this session</span>
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
