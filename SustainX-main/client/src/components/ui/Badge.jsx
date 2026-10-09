// Generic semantic badge. tone: neutral | info | success | warning | danger | high
export default function Badge({ tone = 'neutral', children, dot, className = '', icon }) {
  return (
    <span className={`badge badge-tone-${tone} ${className}`}>
      {dot && <span className="badge-dot" aria-hidden="true" />}
      {icon && <span className="badge-icon" aria-hidden="true">{icon}</span>}
      {children}
    </span>
  );
}