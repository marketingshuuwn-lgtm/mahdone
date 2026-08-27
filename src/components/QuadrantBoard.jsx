import { useMemo, useState } from 'react';
import TaskRow from './TaskRow';
import EmptyState from './EmptyState';
import {
  compareTasksBySchedule,
  getOccurrenceDates,
  isTaskOverdue,
  startOfToday,
  toLocalISO,
} from '../utils/dateUtils';
import { isEffectivelyOpen } from '../utils/taskStatus';

const QUADRANTS = [
  { id: 'important-urgent', title: 'مهم ومستعجل', color: 'var(--danger)' },
  { id: 'important-not-urgent', title: 'مهم غير مستعجل', color: 'var(--accent)' },
  { id: 'not-important-urgent', title: 'غير مهم ومستعجل', color: 'var(--warning)' },
  { id: 'not-important-not-urgent', title: 'غير مهم غير مستعجل', color: 'var(--q4)' },
];

function parseDragId(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isNaN(n) ? raw : n;
}

function sortItems(items, workDays) {
  return [...items].sort((a, b) => compareTasksBySchedule(a, b, { workDays }));
}

function isActiveToday(task, workDays) {
  if (!isEffectivelyOpen(task)) return false;
  const today = startOfToday();
  const iso = toLocalISO(today);
  const occ = getOccurrenceDates(task, today, today, { workDays });
  if (occ.includes(iso)) return true;
  if (!task.dueDate && !task.recurrence) return false;
  return false;
}

function completedOnDay(task, dayIso) {
  if (!task.completed) return false;
  const raw = task.completedAt || task.completed_at;
  if (!raw) return true;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return false;
  return toLocalISO(d) === dayIso;
}

function computeStreak(tasks) {
  const days = new Set();
  tasks.forEach((t) => {
    if (!t.completed && !t.completedAt && !t.completed_at) return;
    const raw = t.completedAt || t.completed_at;
    if (!raw) return;
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) days.add(toLocalISO(d));
  });
  if (days.size === 0) return 0;
  let streak = 0;
  const cursor = startOfToday();
  if (!days.has(toLocalISO(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < 365; i++) {
    const iso = toLocalISO(cursor);
    if (!days.has(iso)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default function QuadrantBoard({
  tasks,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onMoveTask,
  onReorderInQuadrant,
  onAddTask,
  onReschedule,
  workDays,
  workspaces = null,
}) {
  const [collapsed, setCollapsed] = useState({});
  const [dragOverZone, setDragOverZone] = useState(null);
  const [dragOverTaskId, setDragOverTaskId] = useState(null);

  const byQ = useMemo(() => {
    const map = {};
    QUADRANTS.forEach((q) => {
      map[q.id] = sortItems(
        tasks.filter((t) => t.quadrant === q.id),
        workDays
      );
    });
    return map;
  }, [tasks, workDays]);

  const stats = useMemo(() => {
    const todayIso = toLocalISO(startOfToday());
    const todayCount = tasks.filter((t) => isActiveToday(t, workDays)).length;
    const completedToday = tasks.filter((t) => completedOnDay(t, todayIso)).length;
    const overdue = tasks.filter((t) => isTaskOverdue(t, { workDays })).length;
    const streak = computeStreak(tasks);
    return { todayCount, completedToday, overdue, streak };
  }, [tasks, workDays]);

  const toggleCollapse = (id) => setCollapsed((p) => ({ ...p, [id]: !p[id] }));
  const anyCollapsed = QUADRANTS.some((q) => collapsed[q.id]);
  const collapseAll = () => {
    const n = {};
    QUADRANTS.forEach((q) => {
      n[q.id] = true;
    });
    setCollapsed(n);
  };
  const expandAll = () => setCollapsed({});

  const handleDropOnZone = (e, qId) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverZone(null);
    setDragOverTaskId(null);
    const id = parseDragId(e.dataTransfer.getData('text/plain'));
    if (id == null) return;

    const task = tasks.find((t) => String(t.id) === String(id));
    if (!task) return;

    if (dragOverTaskId && task.quadrant === qId && onReorderInQuadrant) {
      const list = byQ[qId].map((t) => t.id);
      const from = list.findIndex((x) => String(x) === String(id));
      const to = list.findIndex((x) => String(x) === String(dragOverTaskId));
      if (from >= 0 && to >= 0 && from !== to) {
        const next = [...list];
        next.splice(from, 1);
        next.splice(to, 0, id);
        onReorderInQuadrant(qId, next);
        return;
      }
    }

    if (task.quadrant !== qId) onMoveTask(id, qId);
  };

  return (
    <div className="matrix-stack">
      <div className="matrix-stats">
        <div className="matrix-stat">
          <span className="matrix-stat-value">{stats.todayCount}</span>
          <span className="matrix-stat-label">مهام اليوم</span>
        </div>
        <div className="matrix-stat">
          <span className="matrix-stat-value">{stats.completedToday}</span>
          <span className="matrix-stat-label">مكتملة اليوم</span>
        </div>
        <div className={`matrix-stat ${stats.overdue ? 'is-warn' : ''}`}>
          <span className="matrix-stat-value">{stats.overdue}</span>
          <span className="matrix-stat-label">متأخرة</span>
        </div>
        <div className="matrix-stat">
          <span className="matrix-stat-value">
            {stats.streak > 0 ? `${stats.streak}` : '0'}
            {stats.streak > 0 && <span className="matrix-stat-fire" aria-hidden>🔥</span>}
          </span>
          <span className="matrix-stat-label">سلسلة الإنجاز</span>
        </div>
      </div>

      <div className="board-toolbar matrix-stack-toolbar">
        <button type="button" className="toolbar-btn" onClick={anyCollapsed ? expandAll : collapseAll}>
          <i className={`ph ${anyCollapsed ? 'ph-arrows-out-simple' : 'ph-arrows-in-simple'}`} />
          {anyCollapsed ? 'توسيع الكل' : 'طي الكل'}
        </button>
      </div>

      <div className="matrix-sections">
        {QUADRANTS.map((q) => {
          const items = byQ[q.id];
          const isCollapsed = !!collapsed[q.id];

          return (
            <section
              key={q.id}
              className={`matrix-section ${isCollapsed ? 'is-collapsed' : ''} ${dragOverZone === q.id ? 'is-drag-over' : ''}`}
              style={{ '--section-color': q.color }}
            >
              <button
                type="button"
                className="matrix-section-header"
                onClick={() => toggleCollapse(q.id)}
                aria-expanded={!isCollapsed}
              >
                <span className="matrix-section-edge" aria-hidden />
                <span className="matrix-section-title">{q.title}</span>
                <span className="matrix-section-count">{items.length}</span>
                <i className={`ph ${isCollapsed ? 'ph-caret-left' : 'ph-caret-down'}`} />
              </button>

              {!isCollapsed && (
                <div
                  className="matrix-section-body"
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    setDragOverZone(q.id);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget)) {
                      setDragOverZone(null);
                      setDragOverTaskId(null);
                    }
                  }}
                  onDrop={(e) => handleDropOnZone(e, q.id)}
                >
                  {items.length === 0 ? (
                    <EmptyState
                      icon="ph-tray"
                      title="لا مهام في هذا القسم"
                      hint="اسحب مهمة إلى هنا أو أضف مهمة جديدة"
                      actionLabel={onAddTask ? 'مهمة جديدة' : undefined}
                      onAction={onAddTask}
                    />
                  ) : (
                    items.map((task) => (
                      <div
                        key={task.id}
                        className={dragOverTaskId === task.id ? 'task-drop-target' : ''}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setDragOverTaskId(task.id);
                          setDragOverZone(q.id);
                        }}
                      >
                        <TaskRow
                          task={task}
                          onToggleComplete={onToggleComplete}
                          onSetStatus={onSetStatus}
                          onToggleSubtask={onToggleSubtask}
                          onEdit={onEdit}
                          onDelete={onDelete}
                          onReschedule={onReschedule}
                          workDays={workDays}
                          workspaces={workspaces}
                        />
                      </div>
                    ))
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
