import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { roleMeta } from '../../config/roles';
import Icon from '../ui/Icon';
import SettingsMenu from './SettingsMenu';
import NotificationBell from './NotificationBell';

export default function AppTopbar({ title, subtitle, onToggleMenu }) {
  const { user } = useAuth();
  const meta = roleMeta(user?.role);

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button className="topbar-hamburger" onClick={onToggleMenu} aria-label="Open navigation">
          <Icon name="menu" size={20} />
        </button>
        <div className="topbar-title-group">
          <h1 className="topbar-title">{title}</h1>
          {subtitle && <span className="topbar-subtitle">{subtitle}</span>}
        </div>
      </div>
      <div className="topbar-right">
        <span className="topbar-scope">
          <Icon name="map-pin" size={14} /> {meta.label}
        </span>
        <SettingsMenu />
        <NotificationBell />
      </div>
    </header>
  );
}