import { useEffect, useState } from 'react';
import { formatTaskSchedule, isTaskOverdue } from '../utils/dateUtils';
import { getSubtaskStats, normalizeSubtasks } from '../utils/subtasks';
import { getTaskContextMeta } from '../utils/taskMeta';

const QUADRANT_COLORS = {
  'important-urgent': 'var(--danger)',
  'important-not-urgent': 'var(--accent)',
  'not-important-urgent': 'var(--warning)',
  'not-important-not-urgent': 'var(--q4)',
};

function cleanNotesForDisplay(notes) {
  if (!notes) return '';
  return String(notes)
    .replace(/مرفقات تريلو:\n(?:- .*\n?)*/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export default function TaskCard({
  task,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  draggable = true,
  workDays,
}) {
  const overdue = isTaskOverdue(task);
  const contextMeta = getTaskContextMeta(task.context);
  const subtasks = normalizeSubtasks(task.subtasks);
  const subtaskStats = getSubtaskStats(subtasks);
  const attachments = task.externalMeta?.attachments || [];
  const displayNotes = cleanNotesForDisplay(task.notes);
  const qColor = QUADRANT_COLORS[task.quadrant] || 'var(--accent)';

  const [trackingState, setTrackingState] = useState({ activeTaskId: null, label: '0:00' });

  useEffect(() => {
    const handler = (e) => setTrackingState(e.detail);
    window.addEventListener('time-tracking-state', handler);
    return () => window.removeEventListener('time-tracking-state', handler);
  }, []);

  const isTracking = trackingState.activeTaskId === task.id;
  const status = task.status || (task.completed ? 'completed' : 'not_started');

  return (
    <div
      className={`task-item ${task.completed ? 'completed' : ''} ${overdue ? 'overdue' : ''}`}
      style={{
        '--q-color': qColor,
        '--ctx-color': contextMeta.color,
        '--ctx-bg': contextMeta.bg,
      }}
      draggable={draggable}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('dragging');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('dragging')}
    >
      <button
        type="button"
        className={`task-status-btn status-${status}`}
        onClick={(e) => {
          e.stopPropagation();
          const order = ['not_started', 'in_progress', 'completed'];
          const current = status;
          const next = order[(order.indexOf(current) + 1) % order.length];
          if (onSetStatus) onSetStatus(task.id, next);
          else onToggleComplete(task.id);
        }}
        title={
          {
            not_started: 'لم تبدأ — اضغط للبدء',
            in_progress: 'قيد التنفيذ — اضغط للإكمال',
            completed: 'مكتملة — اضغط لإعادة الفتح',
          }[status]
        }
      >
        {status === 'completed' && <i className="ph ph-check" style={{ fontSize: 13 }}></i>}
        {status === 'in_progress' && <span className="status-dot"></span>}
      </button>
      <div className="task-content" onClick={() => onEdit(task.id)}>
        <div className="task-title-row">
          <div className="task-title">{task.title}</div>
          <span
            className="task-context-badge"
            style={{ '--ctx-color': contextMeta.color, '--ctx-bg': contextMeta.bg }}
            title={`المساحة: ${contextMeta.label}`}
          >
            <i className={`ph ${contextMeta.icon}`}></i>
            {contextMeta.label}
          </span>
          {task.externalSource === 'trello' && (
            <span className="task-source-badge" title="من تريلو">
              <i className="ph ph-kanban"></i>
            </span>
          )}
        </div>
        <div className={`task-deadline ${overdue ? 'is-overdue' : ''}`}>
          <i className="ph ph-calendar-blank"></i> {formatTaskSchedule(task, { workDays })}
          {overdue && <span className="overdue-tag">متأخرة</span>}
        </div>
        {task.timeSpentSeconds > 0 && (
          <div className="task-time-spent">
            <i className="ph ph-hourglass-medium"></i>
            {Math.floor(task.timeSpentSeconds / 3600) > 0
              ? `${Math.floor(task.timeSpentSeconds / 3600)}س ${Math.floor((task.timeSpentSeconds % 3600) / 60)}د`
              : `${Math.floor(task.timeSpentSeconds / 60)}د`}{' '}
            مصروفة
          </div>
        )}
        {subtaskStats.total > 0 && (
          <div className="task-subtasks" onClick={(e) => e.stopPropagation()}>
            <div className="subtask-progress-row">
              <span>
                <i className="ph ph-check-square-offset"></i>
                {subtaskStats.completed}/{subtaskStats.total}
              </span>
              <div className="subtask-progress-bg">
                <div className="subtask-progress-fill" style={{ width: `${subtaskStats.percent}%` }} />
              </div>
            </div>
            <div className="task-subtask-preview-list">
              {subtasks.slice(0, 3).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`task-subtask-preview ${item.completed ? 'done' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSubtask?.(task.id, item.id);
                  }}
                  title={item.completed ? 'إلغاء إنجاز المهمة الفرعية' : 'إنجاز المهمة الفرعية'}
                >
                  <span className={`mini-check ${item.completed ? 'checked' : ''}`}>
                    {item.completed && <i className="ph ph-check"></i>}
                  </span>
                  <span>{item.title}</span>
                </button>
              ))}
              {subtasks.length > 3 && (
                <span className="subtask-more">+{subtasks.length - 3}</span>
              )}
            </div>
          </div>
        )}
        {displayNotes && (
          <div className="task-notes">
            <i className="ph ph-note-pencil"></i>{' '}
            {displayNotes.length > 140 ? displayNotes.slice(0, 140) + '…' : displayNotes}
          </div>
        )}
        {attachments.length > 0 && (
          <div className="task-attachments" onClick={(e) => e.stopPropagation()}>
            {attachments.slice(0, 4).map((a) => (
              <a
                key={a.id || a.url}
                href={a.url}
                target="_blank"
                rel="noreferrer"
                className="task-attach-chip"
                title={a.name}
              >
                <i className="ph ph-paperclip"></i>
                <span>{a.name || 'مرفق'}</span>
              </a>
            ))}
            {attachments.length > 4 && (
              <span className="subtask-more">+{attachments.length - 4}</span>
            )}
          </div>
        )}
      </div>
      <div className="task-actions" onMouseDown={(e) => e.stopPropagation()}>
        {task.externalUrl && (
          <a
            href={task.externalUrl}
            target="_blank"
            rel="noreferrer"
            className="btn-icon"
            title="فتح في تريلو"
            onClick={(e) => e.stopPropagation()}
          >
            <i className="ph ph-arrow-square-out" style={{ fontSize: 16 }}></i>
          </a>
        )}
        <button
          type="button"
          className={`btn-icon ${isTracking ? 'time-tracking-active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('toggle-time-tracking', {
                detail: { taskId: task.id, title: task.title },
              })
            );
          }}
          title={isTracking ? 'إيقاف تتبع الوقت' : 'بدء تتبع الوقت'}
        >
          <i className={`ph ${isTracking ? 'ph-pause-circle' : 'ph-clock-countdown'}`} style={{ fontSize: 16 }}></i>
        </button>
        {isTracking && <span className="time-tracking-badge">{trackingState.label}</span>}
        <button
          type="button"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            const event = new CustomEvent('start-pomodoro-task', {
              detail: { taskId: task.id, title: task.title, context: task.context },
            });
            window.dispatchEvent(event);
          }}
          title="تشغيل بومودورو"
        >
          <i className="ph ph-play-circle" style={{ fontSize: 16 }}></i>
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            window.dispatchEvent(
              new CustomEvent('open-task-notes', {
                detail: { taskId: task.id, title: task.title },
              })
            );
          }}
          title="المسودات والمراجع"
        >
          <i className="ph ph-note-pencil" style={{ fontSize: 16 }}></i>
        </button>
        <button
          type="button"
          className="btn-icon"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(task.id);
          }}
          title="تعديل"
        >
          <i className="ph ph-pencil-simple"></i>
        </button>
        <button
          type="button"
          className="btn-icon danger"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(task.id);
          }}
          title="أرشفة المهمة"
        >
          <i className="ph ph-archive"></i>
        </button>
      </div>
    </div>
  );
}
