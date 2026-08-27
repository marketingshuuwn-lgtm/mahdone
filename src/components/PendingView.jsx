import { useMemo, useState } from 'react';
import TaskRow from './TaskRow';
import EmptyState from './EmptyState';
import {
  compareTasksBySchedule,
  getOccurrenceDates,
  getTaskStartDate,
  isTaskOverdue,
  startOfToday,
} from '../utils/dateUtils';
import { isEffectivelyOpen } from '../utils/taskStatus';
import PageHeader from './PageHeader';

const QUADRANTS = [
  { id: 'all', label: 'الكل', color: 'var(--text-primary)' },
  { id: 'important-urgent', label: 'مهم ومستعجل', color: 'var(--danger)' },
  { id: 'important-not-urgent', label: 'مهم غير مستعجل', color: 'var(--accent)' },
  { id: 'not-important-urgent', label: 'غير مهم ومستعجل', color: 'var(--warning)' },
  { id: 'not-important-not-urgent', label: 'غير مهم غير مستعجل', color: 'var(--q4)' },
];

const DATE_FILTERS = [
  { id: 'all', label: 'الكل' },
  { id: 'overdue', label: 'متأخر' },
  { id: 'today', label: 'اليوم' },
  { id: 'tomorrow', label: 'غدا' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'nextweek', label: 'الأسبوع القادم' },
  { id: 'nodate', label: 'بدون تاريخ' },
  { id: 'range', label: 'نطاق' },
];

const TIME_GROUPS = [
  { id: 'overdue', label: 'متأخرة', color: 'var(--danger)' },
  { id: 'today', label: 'اليوم', color: 'var(--accent)' },
  { id: 'tomorrow', label: 'غداً', color: 'var(--warning)' },
  { id: 'week', label: 'هذا الأسبوع', color: 'var(--success)' },
  { id: 'later', label: 'لاحقاً', color: 'var(--text-secondary)' },
  { id: 'nodate', label: 'بدون تاريخ', color: 'var(--q4)' },
];

function hasOccurrenceInRange(task, fromDate, toDate, workDays) {
  return getOccurrenceDates(task, fromDate, toDate, { workDays }).length > 0;
}

function assignTimeBucket(task, today, workDays) {
  if (!getTaskStartDate(task) && !task.recurrence) return 'nodate';
  if (isTaskOverdue(task, { workDays })) return 'overdue';

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  if (hasOccurrenceInRange(task, today, today, workDays)) return 'today';
  if (hasOccurrenceInRange(task, tomorrow, tomorrow, workDays)) return 'tomorrow';

  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  weekStart.setHours(12, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  if (hasOccurrenceInRange(task, today, weekEnd, workDays)) return 'week';
  return 'later';
}

export default function PendingView({
  tasks,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onAddTask,
  onReschedule,
  workDays,
  workspaces = null,
}) {
  const [qFilter, setQFilter] = useState('all');
  const [dFilter, setDFilter] = useState('all');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');

  const today = useMemo(() => startOfToday(), []);

  const filtered = useMemo(() => {
    let list = tasks.filter((t) => isEffectivelyOpen(t));

    if (qFilter !== 'all') {
      list = list.filter((t) => t.quadrant === qFilter);
    }

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay());
    weekStart.setHours(12, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const nextWeekStart = new Date(weekStart);
    nextWeekStart.setDate(weekStart.getDate() + 7);
    const nextWeekEnd = new Date(nextWeekStart);
    nextWeekEnd.setDate(nextWeekStart.getDate() + 6);

    if (dFilter === 'overdue') list = list.filter((t) => isTaskOverdue(t, { workDays }));
    else if (dFilter === 'today') list = list.filter((t) => hasOccurrenceInRange(t, today, today, workDays));
    else if (dFilter === 'tomorrow')
      list = list.filter((t) => hasOccurrenceInRange(t, tomorrow, tomorrow, workDays));
    else if (dFilter === 'week')
      list = list.filter((t) => hasOccurrenceInRange(t, weekStart, weekEnd, workDays));
    else if (dFilter === 'nextweek')
      list = list.filter((t) => hasOccurrenceInRange(t, nextWeekStart, nextWeekEnd, workDays));
    else if (dFilter === 'nodate') list = list.filter((t) => !getTaskStartDate(t));
    else if (dFilter === 'range' && rangeFrom && rangeTo) {
      const from = new Date(`${rangeFrom}T12:00:00`);
      const to = new Date(`${rangeTo}T12:00:00`);
      list = list.filter((t) => hasOccurrenceInRange(t, from, to, workDays));
    }

    return [...list].sort((a, b) => compareTasksBySchedule(a, b, { workDays }));
  }, [tasks, qFilter, dFilter, rangeFrom, rangeTo, today, workDays]);

  const groups = useMemo(() => {
    const map = Object.fromEntries(TIME_GROUPS.map((g) => [g.id, []]));
    filtered.forEach((t) => {
      const bucket = assignTimeBucket(t, today, workDays);
      if (map[bucket]) map[bucket].push(t);
      else map.later.push(t);
    });
    return TIME_GROUPS.map((g) => ({ ...g, items: map[g.id] || [] })).filter((g) => g.items.length > 0);
  }, [filtered, today, workDays]);

  return (
    <div className="pending-view">
      <PageHeader
        eyebrow="قائمة العمل"
        title="المهام المعلقة"
        description="راجع ما ينتظر قرارًا أو تنفيذًا، ثم استخدم الفلاتر للوصول إلى الجزء الذي تحتاجه فقط."
        meta={<span>{filtered.length} مهمة مطابقة حاليًا</span>}
      />

      <div className="pending-toolbar">
        <div className="pending-toolbar-row">
          <span className="pending-toolbar-label">أولوية</span>
          <div className="filter-chips">
            {QUADRANTS.map((q) => (
              <button
                key={q.id}
                type="button"
                className={`filter-chip ${qFilter === q.id ? 'active' : ''}`}
                onClick={() => setQFilter(q.id)}
                title={q.label}
              >
                <span className="filter-chip-dot" style={{ background: q.color }} />
                {q.label}
              </button>
            ))}
          </div>
        </div>
        <div className="pending-toolbar-row">
          <span className="pending-toolbar-label">تاريخ</span>
          <div className="filter-chips">
            {DATE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`filter-chip ${dFilter === f.id ? 'active' : ''}`}
                onClick={() => setDFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>
          {dFilter === 'range' && (
            <div className="filter-range-inputs">
              <input
                type="date"
                className="form-input"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
              <span>إلى</span>
              <input
                type="date"
                className="form-input"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>

      <p className="pending-count-hint">{filtered.length} مهمة</p>

      {filtered.length === 0 ? (
        <EmptyState
          icon="ph-check-circle"
          title="لا مهام معلقة مطابقة"
          hint="غيّر الفلاتر أو أضف مهمة جديدة"
          actionLabel={onAddTask ? 'مهمة جديدة' : undefined}
          onAction={onAddTask}
        />
      ) : (
        <div className="matrix-sections">
          {groups.map((g) => (
            <section
              key={g.id}
              className="matrix-section"
              style={{ '--section-color': g.color }}
            >
              <div className="matrix-section-header pending-group-head">
                <span className="matrix-section-edge" aria-hidden />
                <span className="matrix-section-title">{g.label}</span>
                <span className="matrix-section-count">{g.items.length}</span>
              </div>
              <div className="matrix-section-body">
                {g.items.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    onToggleComplete={onToggleComplete}
                    onSetStatus={onSetStatus}
                    onToggleSubtask={onToggleSubtask}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReschedule={onReschedule}
                    draggable={false}
                    workDays={workDays}
                    workspaces={workspaces}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
