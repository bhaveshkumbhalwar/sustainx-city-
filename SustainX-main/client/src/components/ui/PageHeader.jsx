import Icon from './Icon';

export default function PageHeader({ title, subtitle, icon, actions }) {
  return (
    <div className="page-header">
      <div className="page-header-title-wrap">
        {icon && (
          <div className="page-header-icon" aria-hidden="true">
            <Icon name={icon} size={22} />
          </div>
        )}
        <div>
          <h1 className="page-header-title">{title}</h1>
          {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </div>
  );
}