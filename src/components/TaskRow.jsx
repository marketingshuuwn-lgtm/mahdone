import { useEffect, useRef, useState } from 'react';
import {
  formatTaskSchedule,
  isTaskOverdue,
  isRecurringTask,
  toLocalISO,
  startOfToday,
} from '../utils/dateUtils';
import { getSubtaskStats, normalizeSubtasks } from '../utils/subtasks';
import { getTaskContextMeta } from '../utils/taskMeta';
import {
  isCompletedToday,
  nextCycleStatus,
  normalizeTaskStatus,
} from '../utils/taskStatus';
import { SCHEDULE_REASONS } from '../utils/scheduleLog';

const QUADRANT_COLORS = {
  'important-urgent': 'var(--danger)',
  'important-not-urgent': 'var(--accent)',
  'not-important-urgent': 'var(--warning)',
  'not-important-not-urgent': 'var(--q4)',
};

const DRAFT_PREFIX = 'mahd_task_draft_v1:';

function hasTaskDraft(taskId) {
  if (taskId == null) return false;
  try {
    const raw = localStorage.getItem(`${DRAFT_PREFIX}${taskId}`);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    return Boolean(parsed?.form);
  } catch {
    return false;
  }
}

/**
 * قرارات يومية سريعة: دورة الحالة فقط.
 * تغيير الموعد: تعديل المهمة أو إعادة الجدولة من ⋮
 * تعليق: خارج الدورة من ⋮
 */
export default function TaskRow({
  task,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onRestore,
  onReschedule,
  variant = 'default',
  draggable = true,
  workDays,
  workspaces = null,
  exiting = false,
}) {
  const isArchive = variant === 'archive';
  const status = normalizeTaskStatus(task);
  const doneToday = isCompletedToday(task, null, toLocalISO, startOfToday);
  const showAsCompleted =
    status === 'completed' && (!isRecurringTask(task) || doneToday);
  const overdue =
    !isArchive && status !== 'deferred' && isTaskOverdue(task, { workDays });
  const contextMeta = getTaskContextMeta(task.context, workspaces);
  const subtasks = normalizeSubtasks(task.subtasks);
  const subtaskStats = getSubtaskStats(subtasks);
  const qColor = QUADRANT_COLORS[task.quadrant] || 'var(--accent)';
  const draft = !isArchive && hasTaskDraft(task.id);

  const [menuOpen, setMenuOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(task.dueDate || '');
  const menuRef = useRef(null);

  useEffect(() => {
    setRescheduleDate(task.dueDate || '');
  }, [task.dueDate, task.id]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    // click بدل mousedown حتى لا يُقطع تفاعل حقل التاريخ قبل اكتمال النقر
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [menuOpen]);

  const runMenuAction = (fn) => (e) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuOpen(false);
    fn?.();
  };

  return (
    <div
      className={`task-row task-row-enter ${showAsCompleted ? 'is-completed' : ''} ${overdue ? 'is-overdue' : ''} ${status === 'deferred' ? 'is-deferred' : ''} ${draft ? 'has-draft' : ''} ${isArchive ? 'is-archive' : ''} ${exiting ? 'is-exiting' : ''}`}
      style={{ '--q-color': qColor, '--ctx-color': contextMeta.color, '--ctx-bg': contextMeta.bg }}
      draggable={draggable && !isArchive && !exiting && status !== 'deferred'}
      onDragStart={(e) => {
        if (isArchive || exiting) return;
        e.dataTransfer.setData('text/plain', String(task.id));
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.classList.add('is-dragging');
      }}
      onDragEnd={(e) => e.currentTarget.classList.remove('is-dragging')}
    >
      {!isArchive ? (
        <div className="task-row-daily" onMouseDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            className={`task-row-status status-${status}`}
            onClick={(e) => {
              e.stopPropagation();
              if (status === 'deferred' || status === 'cancelled') {
                onSetStatus?.(task.id, 'not_started');
                return;
              }
              const next = nextCycleStatus(status);
              if (onSetStatus) onSetStatus(task.id, next);
              else onToggleComplete?.(task.id);
            }}
            title={
              {
                not_started: 'لم تبدأ',
                in_progress: 'قيد التنفيذ',
                completed: 'مكتملة',
                deferred: 'معلّقة — اضغط لإعادتها للدورة',
                cancelled: 'ملغاة',
              }[status]
            }
            aria-label="حالة العمل"
          >
            {showAsCompleted && <i className="ph ph-check" />}
            {status === 'in_progress' && <span className="status-dot" />}
            {status === 'deferred' && <i className="ph ph-pause" />}
          </button>
        </div>
      ) : (
        <span
          className={`task-row-status status-archived ${status === 'cancelled' ? 'status-cancelled' : ''}`}
          title={status === 'cancelled' ? 'ملغاة ومؤرشفة' : 'مؤرشفة'}
          aria-hidden
        >
          <i className={`ph ${status === 'cancelled' ? 'ph-x' : 'ph-archive'}`} />
        </span>
      )}

      <div
        className="task-row-body"
        onClick={() => onEdit?.(task.id)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEdit?.(task.id);
        }}
      >
        <div className="task-row-main">
          <span className="task-row-title">
            {draft && (
              <span className="task-draft-dot" title="مسودة غير محفوظة" aria-label="مسودة">
                <span className="task-draft-dot-inner" />
              </span>
            )}
            {task.title}
          </span>

          <div className="task-row-chips">
            <span className="task-row-chip context" title={`المساحة: ${contextMeta.label}`}>
              <i className={`ph ${contextMeta.icon}`} />
              {contextMeta.label}
            </span>
            {overdue && <span className="task-row-chip overdue-chip">متأخرة</span>}
            {status === 'deferred' && (
              <span className="task-row-chip deferred" title="خارج الدورة الحالية">
                معلّقة
              </span>
            )}
            {draft && <span className="task-row-chip draft-chip">مسودة</span>}
            {task.recurrence && (
              <span className="task-row-chip mute" title="متكررة">
                <i className="ph ph-arrows-clockwise" />
              </span>
            )}
            {task.externalSource === 'trello' && (
              <span className="task-row-chip source" title="من تريلو">
                <i className="ph ph-kanban" />
              </span>
            )}
            {subtaskStats.total > 0 && (
              <span className="task-row-chip mute">
                {subtaskStats.completed}/{subtaskStats.total}
              </span>
            )}
            {status === 'cancelled' && isArchive && (
              <span className="task-row-chip cancelled">ملغاة</span>
            )}
          </div>
        </div>

        <div className={`task-row-date ${overdue ? 'overdue' : ''}`}>
          <i className="ph ph-calendar-blank" />
          <span>{formatTaskSchedule(task, { workDays })}</span>
        </div>

        {!isArchive && subtaskStats.total > 0 && (
          <div className="task-row-subtasks" onClick={(e) => e.stopPropagation()}>
            {subtasks.slice(0, 3).map((item) => (
              <button
                key={item.id}
                type="button"
                className={`task-row-sub ${item.completed ? 'done' : ''}`}
                onClick={() => onToggleSubtask?.(task.id, item.id)}
              >
                <span className={`mini-check ${item.completed ? 'checked' : ''}`}>
                  {item.completed && <i className="ph ph-check" />}
                </span>
                {item.title}
              </button>
            ))}
            {subtasks.length > 3 && (
              <span className="task-row-more">+{subtasks.length - 3}</span>
            )}
          </div>
        )}
      </div>

      <div
        className="task-row-manage"
        ref={menuRef}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
      >
        {isArchive ? (
          <>
            <button
              type="button"
              className="btn-icon"
              title="استرجاع"
              onClick={(e) => {
                e.stopPropagation();
                onRestore?.(task.id);
              }}
            >
              <i className="ph ph-arrow-counter-clockwise" />
            </button>
            <button
              type="button"
              className="btn-icon"
              title="تعديل"
              onClick={(e) => {
                e.stopPropagation();
                onEdit?.(task.id);
              }}
            >
              <i className="ph ph-pencil-simple" />
            </button>
          </>
        ) : (
          <div className="task-row-menu-wrap">
            <button
              type="button"
              className="btn-icon task-row-more-btn"
              title="المزيد"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <i className="ph ph-dots-three-vertical" />
            </button>
            {menuOpen && (
              <div
                className="task-row-menu"
                role="menu"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={runMenuAction(() => onEdit?.(task.id))}
                >
                  <i className="ph ph-pencil-simple" />
                  تعديل
                </button>

                <div className="task-row-menu-reschedule">
                  <label htmlFor={`reschedule-${task.id}`}>إعادة الجدولة — موعد جديد</label>
                  <input
                    id={`reschedule-${task.id}`}
                    type="date"
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!rescheduleDate}
                    onClick={runMenuAction(() => {
                      if (!rescheduleDate) return;
                      onReschedule?.(task.id, rescheduleDate, {
                        reason: SCHEDULE_REASONS.reschedule,
                      });
                    })}
                  >
                    <i className="ph ph-calendar-check" />
                    تأكيد الموعد الجديد
                  </button>
                </div>

                {status !== 'deferred' && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={runMenuAction(() => onSetStatus?.(task.id, 'deferred'))}
                  >
                    <i className="ph ph-pause-circle" />
                    تعليق — خارج الدورة
                  </button>
                )}

                <button
                  type="button"
                  role="menuitem"
                  onClick={runMenuAction(() => {
                    window.dispatchEvent(
                      new CustomEvent('open-task-notes', {
                        detail: { taskId: task.id, title: task.title },
                      })
                    );
                  })}
                >
                  <i className="ph ph-note-pencil" />
                  ملاحظات
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={runMenuAction(() => {
                    window.dispatchEvent(
                      new CustomEvent('toggle-time-tracking', {
                        detail: { taskId: task.id, title: task.title },
                      })
                    );
                  })}
                >
                  <i className="ph ph-timer" />
                  تتبع الوقت
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={runMenuAction(() => onDelete?.(task.id))}
                >
                  <i className="ph ph-archive" />
                  أرشفة
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="is-danger"
                  onClick={runMenuAction(() => onSetStatus?.(task.id, 'cancelled'))}
                >
                  <i className="ph ph-x-circle" />
                  إلغاء → أرشيف
                </button>
                {task.externalUrl && (
                  <a
                    href={task.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    role="menuitem"
                    className="task-row-menu-link"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                    }}
                  >
                    <i className="ph ph-arrow-square-out" />
                    فتح في تريلو
                  </a>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
