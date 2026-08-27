import { useEffect } from 'react';

/**
 * غلاف موحّد لكل النوافذ المنبثقة.
 * يفرض: role="dialog" + aria-modal + إغلاق بـ Escape والنقر على الخلفية.
 *
 * يحافظ على class names الحالية (modal-overlay / modal-box) حتى لا تنكسر الأنماط.
 */
export default function Modal({
  isOpen,
  onClose,
  children,
  ariaLabel,
  ariaLabelledBy,
  overlayClassName = 'modal-overlay open',
  panelClassName = 'modal-box card',
  closeOnOverlay = true,
  closeOnEscape = true,
  onPanelKeyDown,
  panelProps = {},
}) {
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return undefined;

    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // لا تسرق Escape من حقول الإدخال ذات السلوك الخاص إن أوقفت الانتشار مسبقاً
      e.preventDefault();
      onClose?.();
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, closeOnEscape, onClose]);

  // قفل تمرير الخلفية أثناء الفتح
  useEffect(() => {
    if (!isOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className={overlayClassName}
      onClick={(e) => {
        if (!closeOnOverlay) return;
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={panelClassName}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onPanelKeyDown}
        {...panelProps}
      >
        {children}
      </div>
    </div>
  );
}
