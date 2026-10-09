import { Outlet, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import Icon from '../ui/Icon';

export default function PublicLayout() {
  const { user } = useAuth();
  const { toggleTheme } = useTheme();
  return (
    <div className="public-page">
      <header className="public-topbar">
        <Link to="/" className="public-brand">
          <Icon name="recycle" size={22} />
          <span>SustainX</span>
        </Link>
        <div className="public-topbar-right">
          <button className="btn btn-ghost btn-sm" onClick={toggleTheme} aria-label="Toggle theme">
            <Icon name="sun" size={18} />
          </button>
          <Link to="/login" className="btn btn-primary btn-sm">
            {user ? 'Open Dashboard' : 'Sign In'}
          </Link>
        </div>
      </header>
      <main className="public-content">
        <Outlet />
      </main>
      <footer className="public-footer">
        <span>SustainX — Smart City Waste Intelligence Platform</span>
      </footer>
    </div>
  );
}