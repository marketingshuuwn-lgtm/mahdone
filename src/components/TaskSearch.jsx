import { useEffect, useMemo, useRef, useState } from 'react';
import { getTaskContextMeta } from '../utils/taskMeta';
import { normalizeTaskStatus, statusMeta } from '../utils/taskStatus';

function matchesQuery(task, q) {
  if (!q) return false;
  const title = String(task.title || '').toLowerCase();
  const notes = String(task.notes || '').toLowerCase();
  return title.includes(q) || notes.includes(q);
}

export default function TaskSearch({
  isOpen,
  onClose,
  tasks = [],
  workspaces = [],
  onSelectTask,
}) {
  const [query, setQuery] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      return undefined;
    }
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [isOpen]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return tasks
      .filter((t) => !t.archived && matchesQuery(t, q))
      .slice(0, 40);
  }, [tasks, query]);

  if (!isOpen) return null;

  return (
    <div
      className="task-search-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className="task-search-panel card"
        role="dialog"
        aria-modal="true"
        aria-label="بحث في المهام"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="task-search-header">
          <i className="ph ph-magnifying-glass task-search-icon" aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            className="task-search-input"
            placeholder="ابحث في العنوان أو الملاحظات…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === 'Escape') {
                e.preventDefault();
                onClose?.();
              }
              if (e.key === 'Enter' && results[0]) {
                e.preventDefault();
                onSelectTask?.(results[0].id);
                onClose?.();
              }
            }}
            autoComplete="off"
            aria-label="نص البحث"
          />
          <kbd className="task-search-kbd">Esc</kbd>
          <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق البحث">
            <i className="ph ph-x" />
          </button>
        </div>

        <div className="task-search-body">
          {!query.trim() && (
            <p className="task-search-hint">اكتب للبحث عبر كل المساحات · Enter يفتح أول نتيجة</p>
          )}
          {query.trim() && results.length === 0 && (
            <p className="task-search-hint">لا نتائج لـ «{query.trim()}»</p>
          )}
          {results.length > 0 && (
            <ul className="task-search-list" role="listbox">
              {results.map((task) => {
                const ctx = getTaskContextMeta(task.context, workspaces);
                const st = statusMeta(normalizeTaskStatus(task));
                return (
                  <li key={task.id}>
                    <button
                      type="button"
                      className="task-search-item"
                      role="option"
                      onClick={() => {
                        onSelectTask?.(task.id);
                        onClose?.();
                      }}
                    >
                      <span className="task-search-item-title">{task.title}</span>
                      <span className="task-search-item-meta">
                        <span
                          className="task-search-space"
                          style={{ color: ctx.color, background: ctx.bg }}
                        >
                          <i className={`ph ${ctx.icon}`} />
                          {ctx.label}
                        </span>
                        <span className="task-search-status">{st.label}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
