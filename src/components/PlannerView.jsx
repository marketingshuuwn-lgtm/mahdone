import { useMemo, useState } from 'react';
import {
  getOccurrenceDates,
  isRecurringTask,
  toLocalISO,
  formatDate,
} from '../utils/dateUtils';
import { isCompletedToday, normalizeTaskStatus } from '../utils/taskStatus';

const DAY_NAMES = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];
const MAX_CHIPS = 3;

function startOfMonth(d) {
  return new Date(d.getFullYear(), d.getMonth(), 1, 12, 0, 0, 0);
}

function buildMonthCells(cursor) {
  const first = startOfMonth(cursor);
  const startPad = first.getDay(); // 0 = Sunday
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startPad);

  const cells = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + i);
    date.setHours(12, 0, 0, 0);
    cells.push({
      date,
      iso: toLocalISO(date),
      inMonth: date.getMonth() === cursor.getMonth(),
    });
  }
  return cells;
}

function isTaskDoneOnDay(task, iso) {
  const status = normalizeTaskStatus(task);
  if (status === 'cancelled') return true;
  if (isRecurringTask(task)) {
    return isCompletedToday(task, iso, toLocalISO, () => new Date(`${iso}T12:00:00`));
  }
  return status === 'completed' || Boolean(task.completed);
}

export default function PlannerView({
  tasks = [],
  onToggleComplete,
  onEdit,
  onReschedule,
  onAddTask,
  workDays,
}) {
  const todayIso = useMemo(() => toLocalISO(new Date()), []);
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selectedIso, setSelectedIso] = useState(todayIso);
  const [dragId, setDragId] = useState(null);
  const [overIso, setOverIso] = useState(null);

  const cells = useMemo(() => buildMonthCells(cursor), [cursor]);

  const rangeFrom = cells[0]?.date;
  const rangeTo = cells[cells.length - 1]?.date;

  const tasksByDay = useMemo(() => {
    const map = new Map();
    if (!rangeFrom || !rangeTo) return map;

    tasks.forEach((task) => {
      if (!task?.dueDate && !isRecurringTask(task)) return;
      const occ = getOccurrenceDates(task, rangeFrom, rangeTo, { workDays });
      occ.forEach((iso) => {
        if (!map.has(iso)) map.set(iso, []);
        map.get(iso).push(task);
      });
    });
    return map;
  }, [tasks, rangeFrom, rangeTo, workDays]);

  const undated = useMemo(
    () => tasks.filter((t) => !t.dueDate && !isRecurringTask(t)),
    [tasks]
  );

  const selectedTasks = tasksByDay.get(selectedIso) || [];

  const goMonth = (delta) => {
    setCursor((prev) => {
      const next = new Date(prev);
      next.setMonth(prev.getMonth() + delta);
      return startOfMonth(next);
    });
  };

  const goToday = () => {
    const now = startOfMonth(new Date());
    setCursor(now);
    setSelectedIso(todayIso);
  };

  const dropOn = (e, iso) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('text/plain') || String(dragId || '');
    setDragId(null);
    setOverIso(null);
    if (!raw || !iso) return;
    onReschedule?.(raw, iso);
  };

  const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  return (
    <div className="card planner-card">
      <div className="planner-toolbar">
        <div className="planner-nav">
          <button type="button" className="btn-icon" onClick={() => goMonth(-1)} title="الشهر السابق">
            <i className="ph ph-caret-right"></i>
          </button>
          <h3 className="planner-month-title">{monthLabel}</h3>
          <button type="button" className="btn-icon" onClick={() => goMonth(1)} title="الشهر التالي">
            <i className="ph ph-caret-left"></i>
          </button>
        </div>
        <div className="planner-toolbar-actions">
          <button type="button" className="btn-secondary planner-today-btn" onClick={goToday}>
            اليوم
          </button>
          {onAddTask && (
            <button type="button" className="btn-primary" onClick={onAddTask}>
              <i className="ph ph-plus"></i>
              مهمة
            </button>
          )}
        </div>
      </div>

      <p className="gantt-hint planner-hint">
        <i className="ph ph-hand-grabbing"></i>
        اسحب مهمة إلى يوم آخر لإعادة جدولتها — المتكرر يظهر في أيام التكرار فقط
      </p>

      <div className="planner-grid" role="grid" aria-label="تقويم المهام">
        {DAY_NAMES.map((name) => (
          <div key={name} className="planner-weekday" role="columnheader">
            {name}
          </div>
        ))}

        {cells.map(({ date, iso, inMonth }) => {
          const dayTasks = tasksByDay.get(iso) || [];
          const isToday = iso === todayIso;
          const isSelected = iso === selectedIso;
          const isOver = overIso === iso && dragId;
          const visible = dayTasks.slice(0, MAX_CHIPS);
          const extra = dayTasks.length - visible.length;

          return (
            <div
              key={iso}
              role="gridcell"
              className={
                `planner-cell` +
                (inMonth ? '' : ' is-outside') +
                (isToday ? ' is-today' : '') +
                (isSelected ? ' is-selected' : '') +
                (isOver ? ' is-over' : '')
              }
              onClick={() => setSelectedIso(iso)}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setOverIso(iso);
              }}
              onDragLeave={() => setOverIso((v) => (v === iso ? null : v))}
              onDrop={(e) => dropOn(e, iso)}
            >
              <div className="planner-cell-head">
                <span className="planner-day-num">{date.getDate()}</span>
                {dayTasks.length > 0 && (
                  <span className="planner-day-count">{dayTasks.length}</span>
                )}
              </div>
              <div className="planner-chips">
                {visible.map((task) => {
                  const done = isTaskDoneOnDay(task, iso);
                  const recurring = isRecurringTask(task);
                  return (
                    <button
                      key={`${task.id}-${iso}`}
                      type="button"
                      className={
                        `planner-chip ${task.quadrant || 'q2'}` +
                        (done ? ' is-done' : '') +
                        (recurring ? ' is-recurring' : '')
                      }
                      draggable
                      title={task.title}
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(task.id);
                      }}
                      onDragStart={(e) => {
                        e.stopPropagation();
                        e.dataTransfer.setData('text/plain', String(task.id));
                        e.dataTransfer.effectAllowed = 'move';
                        setDragId(task.id);
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverIso(null);
                      }}
                    >
                      {recurring && <i className="ph ph-arrows-clockwise planner-chip-icon"></i>}
                      <span className="planner-chip-text">{task.title}</span>
                    </button>
                  );
                })}
                {extra > 0 && (
                  <span className="planner-more">+{extra}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="planner-day-panel">
        <div className="planner-day-panel-head">
          <h4>
            <i className="ph ph-calendar-blank"></i>
            {formatDate(selectedIso)}
            {selectedIso === todayIso && <span className="planner-today-tag">اليوم</span>}
          </h4>
          <span className="planner-day-panel-count">{selectedTasks.length} مهمة</span>
        </div>

        {selectedTasks.length === 0 ? (
          <p className="planner-empty">لا مهام مجدولة في هذا اليوم</p>
        ) : (
          <ul className="planner-day-list">
            {selectedTasks.map((task) => {
              const done = isTaskDoneOnDay(task, selectedIso);
              const recurring = isRecurringTask(task);
              return (
                <li key={task.id} className={`planner-day-item ${done ? 'is-done' : ''}`}>
                  <button
                    type="button"
                    className={`task-checkbox ${done ? 'checked' : ''}`}
                    style={{ width: 18, height: 18 }}
                    onClick={() => onToggleComplete?.(task.id)}
                    title={done ? 'إلغاء الإنجاز' : 'إنجاز'}
                  >
                    {done && <i className="ph ph-check" style={{ fontSize: 10 }}></i>}
                  </button>
                  <button
                    type="button"
                    className="planner-day-item-title"
                    onClick={() => onEdit?.(task.id)}
                  >
                    <span className={`planner-q-dot ${task.quadrant || 'q2'}`}></span>
                    {task.title}
                    {recurring && (
                      <i className="ph ph-arrows-clockwise" title="متكررة"></i>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {undated.length > 0 && (
          <div className="planner-undated">
            <div className="planner-undated-label">
              <i className="ph ph-clock"></i>
              بدون تاريخ ({undated.length})
            </div>
            <ul className="planner-day-list">
              {undated.slice(0, 8).map((task) => (
                <li key={task.id} className="planner-day-item">
                  <button
                    type="button"
                    className="planner-day-item-title"
                    onClick={() => onEdit?.(task.id)}
                  >
                    <span className={`planner-q-dot ${task.quadrant || 'q2'}`}></span>
                    {task.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
