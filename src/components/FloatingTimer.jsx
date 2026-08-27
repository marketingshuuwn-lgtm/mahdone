import { useEffect, useState } from 'react';
import { usePomodoro } from '../hooks/usePomodoro';
import { notify } from '../hooks/useLocalNotifications';

export default function FloatingTimer() {
  const { running, mode, remaining, taskTitle, start, toggle, reset } = usePomodoro();
  const [visible, setVisible] = useState(false);

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const label = mode === 'work' ? 'تركيز' : 'راحة';

  useEffect(() => {
    const handle = (e) => {
      const { taskId, title, context } = e.detail || {};
      start({
        taskId: taskId ?? null,
        taskTitle: title || null,
        context: context || 'work',
      });
      setVisible(true);
      notify(
        'بومودورو — مهد',
        `بدأت جلسة تركيز${title ? `: ${title}` : ''}`
      );
    };
    window.addEventListener('start-pomodoro-task', handle);
    return () => window.removeEventListener('start-pomodoro-task', handle);
  }, [start]);

  // إظهار اللوحة تلقائياً عند التشغيل من أي مصدر
  useEffect(() => {
    if (running) setVisible(true);
  }, [running]);

  if (!visible) return null;

  return (
    <div className="floating-timer-panel" role="timer" aria-label="مؤقت بومودورو">
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 2 }}>
          {label} — بومودورو
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>
          {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </div>
        {taskTitle && (
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              marginTop: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={taskTitle}
          >
            {taskTitle}
          </div>
        )}
      </div>
      <div className="floating-timer-actions">
        <button
          type="button"
          className="btn-icon"
          onClick={toggle}
          title={running ? 'إيقاف مؤقت' : 'تشغيل'}
        >
          <i className={`ph ${running ? 'ph-pause' : 'ph-play'}`}></i>
        </button>
        <button type="button" className="btn-icon" onClick={reset} title="إعادة ضبط">
          <i className="ph ph-arrow-counter-clockwise"></i>
        </button>
        <button
          type="button"
          className="btn-icon danger"
          onClick={() => {
            if (running) toggle();
            setVisible(false);
          }}
          title="إخفاء المؤقت"
        >
          <i className="ph ph-x"></i>
        </button>
      </div>
    </div>
  );
}
