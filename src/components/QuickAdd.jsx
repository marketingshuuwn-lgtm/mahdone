import { useState } from 'react';
import { parseSmartInput } from '../utils/dateUtils';

const QUADRANTS = [
  { id: 'important-urgent', color: 'var(--danger)', label: 'مهم ومستعجل' },
  { id: 'important-not-urgent', color: 'var(--accent)', label: 'مهم غير مستعجل' },
  { id: 'not-important-urgent', color: 'var(--warning)', label: 'غير مهم ومستعجل' },
  { id: 'not-important-not-urgent', color: 'var(--q4)', label: 'غير مهم غير مستعجل' },
];

export default function FloatingSmartBar({ onAddTask, onOpenAdvanced, activeContext = 'work' }) {
  const [value, setValue] = useState('');
  const [quadrant, setQuadrant] = useState('important-urgent');
  const [minimized, setMinimized] = useState(false);

  const submit = (e) => {
    e?.preventDefault?.();
    const text = value.trim();
    if (!text) return;
    const { title, dueDate } = parseSmartInput(text);
    onAddTask(title || text, quadrant, dueDate, '', 1, { context: activeContext });
    setValue('');
  };

  if (minimized) {
    return (
      <div className="floating-smart-bar floating-minimized">
        <button
          type="button"
          className="floating-restore-btn"
          onClick={() => setMinimized(false)}
          title="إظهار شريط الإضافة"
        >
          <i className="ph ph-plus-circle"></i>
          <i className="ph ph-caret-up"></i>
        </button>
      </div>
    );
  }

  return (
    <div className="floating-smart-bar">
      <form className="floating-smart-inner" onSubmit={submit}>
        <button
          type="button"
          className="floating-hide-btn"
          onClick={() => setMinimized(true)}
          title="إخفاء الشريط"
        >
          <i className="ph ph-caret-down"></i>
        </button>

        <div className="floating-quad-dots" title="أولوية المهمة">
          {QUADRANTS.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`quad-dot-btn ${quadrant === q.id ? 'active' : ''}`}
              style={{ '--dot-color': q.color }}
              title={q.label}
              onClick={() => setQuadrant(q.id)}
              aria-label={q.label}
            />
          ))}
        </div>

        <div className="floating-input-wrap">
          <i className="ph ph-plus floating-ai-icon"></i>
          <input
            type="text"
            className="floating-input"
            placeholder="اسم المهمة… (اختياري: الخميس / 15/8/2026)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>

        <button type="button" className="floating-icon-btn" onClick={onOpenAdvanced} title="إعدادات متقدمة">
          <i className="ph ph-sliders-horizontal"></i>
        </button>

        <button type="submit" className="floating-submit" title="إضافة" disabled={!value.trim()}>
          <i className="ph ph-plus"></i>
        </button>
      </form>
    </div>
  );
}
