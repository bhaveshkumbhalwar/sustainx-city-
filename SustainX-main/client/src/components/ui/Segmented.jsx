import Icon from './Icon';

// Segmented control for small filter groups.
export default function Segmented({ options, value, onChange, className = '' }) {
  return (
    <div className={`segmented ${className}`} role="tablist">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            className={`segmented-btn ${active ? 'segmented-active' : ''}`}
            onClick={() => onChange(opt.value)}
          >
            {opt.icon && <Icon name={opt.icon} size={15} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}