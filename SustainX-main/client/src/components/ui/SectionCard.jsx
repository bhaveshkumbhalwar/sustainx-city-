export default function SectionCard({ title, subtitle, actions, children, className = '', pad = true }) {
  return (
    <section className={`section-card ${className}`}>
      {(title || actions) && (
        <div className="section-card-head">
          <div>
            {title && <h3 className="section-card-title">{title}</h3>}
            {subtitle && <p className="section-card-subtitle">{subtitle}</p>}
          </div>
          {actions && <div className="section-card-actions">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'section-card-body' : 'section-card-body section-card-body-nopad'}>{children}</div>
    </section>
  );
}