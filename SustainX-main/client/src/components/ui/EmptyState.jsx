import Icon from './Icon';

export default function EmptyState({ icon = 'list', title, description, action }) {
  return (
    <div className="state-block empty-state">
      <div className="state-icon" aria-hidden="true">
        <Icon name={icon} size={28} />
      </div>
      <div className="state-title">{title}</div>
      {description && <div className="state-desc">{description}</div>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}