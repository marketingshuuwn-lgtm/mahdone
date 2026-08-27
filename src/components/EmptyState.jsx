/**
 * حالة فارغة = دعوة لفعل واحد واضح (فلسفة إعادة الهيكلة).
 */
export default function EmptyState({
  icon = 'ph-tray',
  title = 'لا يوجد شيء هنا',
  hint,
  actionLabel,
  onAction,
  className = '',
}) {
  return (
    <div className={`empty-cta ${className}`}>
      <div className="empty-cta-icon" aria-hidden>
        <i className={`ph ${icon}`} />
      </div>
      <p className="empty-cta-title">{title}</p>
      {hint && <p className="empty-cta-hint">{hint}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn-primary empty-cta-action" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
