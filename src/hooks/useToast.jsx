import { createContext, useCallback, useContext, useState } from 'react';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;
const DEFAULT_MS = 2600;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const showToast = useCallback((msg, icon = 'ph-check-circle', variant = 'default') => {
    if (!msg) return;
    const id = Date.now() + Math.random();
    const duration = variant === 'error' ? 4200 : DEFAULT_MS;

    setToasts((prev) => {
      // تجميع نفس الرسالة المتكررة بدل تكديس أسود مزعج
      const same = prev.find((t) => t.msg === msg && t.variant === variant);
      if (same) {
        return prev.map((t) => (t.id === same.id ? { ...t, bump: (t.bump || 1) + 1, show: true } : t));
      }
      const next = [...prev, { id, msg, icon, variant, show: false, bump: 1 }];
      return next.slice(-MAX_TOASTS);
    });

    requestAnimationFrame(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: true } : t)));
    });

    setTimeout(() => {
      setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, show: false } : t)));
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 280);
    }, duration);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`toast ${t.show ? 'show' : ''} ${t.variant === 'error' ? 'error' : ''}`}
            role="status"
          >
            <i className={`ph ${t.icon || 'ph-info'}`}></i>
            <span className="toast-msg">{t.msg}</span>
            {t.bump > 1 && <span className="toast-bump">×{t.bump}</span>}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
