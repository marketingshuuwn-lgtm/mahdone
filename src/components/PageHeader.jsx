export default function PageHeader({ eyebrow, title, description, actions, meta, compact = false }) {
  return (
    <header className={`page-hero ${compact ? 'is-compact' : ''}`}>
      <div className="page-hero-copy">
        {eyebrow && <p className="page-hero-eyebrow">{eyebrow}</p>}
        <h1 className="page-hero-title">{title}</h1>
        {description && <p className="page-hero-description">{description}</p>}
        {meta && <div className="page-hero-meta">{meta}</div>}
      </div>
      {actions && <div className="page-hero-actions">{actions}</div>}
    </header>
  );
}
