import { NavLink } from 'react-router-dom';
import Icon from '../ui/Icon';

// Mobile bottom navigation — only the primary actions per role.
export default function MobileNav({ items }) {
  // Desktop-screen navigation is handled by the sidebar; this renders on mobile.
  const primary = items.slice(0, 4);
  return (
    <nav className="mobile-nav" aria-label="Primary navigation">
      {primary.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}
        >
          <span className="mobile-nav-icon">
            <Icon name={item.icon} size={20} />
          </span>
          <span className="mobile-nav-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}