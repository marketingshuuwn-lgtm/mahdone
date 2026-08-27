import { useMemo, useState } from 'react';
import TaskRow from './TaskRow';
import EmptyState from './EmptyState';
import {
  compareTasksBySchedule,
  formatTaskSchedule,
  getOccurrenceDates,
  getTaskStartDate,
  isTaskOverdue,
  startOfToday,
  toLocalISO,
} from '../utils/dateUtils';
import { getTaskContextMeta } from '../utils/taskMeta';
import { isEffectivelyOpen, normalizeTaskStatus } from '../utils/taskStatus';

const PLAN_LIMIT = 3;
const PLAN_STORAGE_PREFIX = 'mahd_today_plan_v3:';

function readPlan(todayIso) {
  try {
    const raw = localStorage.getItem(`${PLAN_STORAGE_PREFIX}${todayIso}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function hasOccurrenceToday(task, today, workDays) {
  return getOccurrenceDates(task, today, today, { workDays }).length > 0;
}

function isCompletedToday(task, todayIso) {
  if (!task.completed) return false;
  const raw = task.completedAt || task.completed_at;
  if (!raw) return false;
  const date = new Date(raw);
  return !Number.isNaN(date.getTime()) && toLocalISO(date) === todayIso;
}

function sortTasks(tasks, workDays) {
  return [...tasks].sort((a, b) => compareTasksBySchedule(a, b, { workDays }));
}

function MiniCalendar({ tasks, today, workDays, projects = [] }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const iso = toLocalISO(date);
    const count = tasks.filter((task) => isEffectivelyOpen(task) && getOccurrenceDates(task, date, date, { workDays }).length > 0).length;
    return { date, iso, count };
  });
  return (
    <aside className="today-calendar-card" aria-label="تقويم الأسبوع">
      <div className="today-calendar-heading"><div><p className="today-section-kicker">السياق الزمني</p><h2>أسبوعك القريب</h2></div><i className="ph ph-calendar-blank" /></div>
      <p className="today-calendar-summary">{projects.length} مشاريع نشطة · {tasks.filter(isEffectivelyOpen).length} مهام مفتوحة</p>
      <div className="today-calendar-days">
        {days.map(({ date, iso, count }, index) => (
          <div key={iso} className={`today-calendar-day ${index === 0 ? 'is-today' : ''}`}><span>{date.toLocaleDateString('ar-EG', { weekday: 'short' })}</span><strong>{date.getDate()}</strong><small>{count ? `${count} مهام` : 'هادئ'}</small></div>
        ))}
      </div>
      <p className="today-calendar-note">التقويم يشرح ما سيأتي؛ خطة اليوم تحدد ما ستنفذه الآن.</p>
    </aside>
  );
}

function TaskCandidate({ task, selected, disabled, onAdd, onEdit, workDays, workspaces, projects = [] }) {
  const project = projects.find((item) => item.id === task.projectId);
  const contextMeta = getTaskContextMeta(task.context, workspaces);
  const status = normalizeTaskStatus(task);
  const overdue = isTaskOverdue(task, { workDays });

  return (
    <article className={`today-candidate ${selected ? 'is-selected' : ''}`}>
      <button
        type="button"
        className="today-candidate-select"
        onClick={() => onAdd(task.id)}
        disabled={disabled && !selected}
        aria-label={selected ? `إزالة ${task.title} من خطة اليوم` : `إضافة ${task.title} إلى خطة اليوم`}
        title={selected ? 'إزالة من الخطة' : disabled ? 'الخطة مكتملة — أزل أولوية أولًا' : 'إضافة إلى خطة اليوم'}
      >
        <i className={`ph ${selected ? 'ph-check-circle' : 'ph-plus-circle'}`} aria-hidden="true" />
      </button>
      <button type="button" className="today-candidate-body" onClick={() => onEdit?.(task.id)}>
        <span className="today-candidate-title">{task.title}</span>
        <span className="today-candidate-meta">
          <span className="today-context-chip" style={{ '--ctx-color': contextMeta.color }}>
            {contextMeta.label}
          </span>
          {project && <span className="today-project-chip">{project.name}</span>}
          <span className={overdue ? 'is-overdue-text' : ''}>
            {overdue ? 'متأخرة' : status === 'in_progress' ? 'قيد التنفيذ' : formatTaskSchedule(task, { workDays })}
          </span>
        </span>
      </button>
      <button type="button" className="today-candidate-more" onClick={() => onEdit?.(task.id)} aria-label={`تفاصيل ${task.title}`}>
        <i className="ph ph-arrow-up-left" aria-hidden="true" />
      </button>
    </article>
  );
}

export default function TodayView({
  tasks,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onAddTask,
  onReschedule,
  onOpenAllTasks,
  workDays,
  workspaces = null,
  projects = [],
}) {
  const today = useMemo(() => startOfToday(), []);
  const todayIso = toLocalISO(today);
  const [mode, setMode] = useState('plan');
  const [planIds, setPlanIds] = useState(() => readPlan(todayIso));
  const [showMoreCandidates, setShowMoreCandidates] = useState(false);

  const daily = useMemo(() => {
    const open = tasks.filter((task) => isEffectivelyOpen(task));
    const overdue = open.filter((task) => isTaskOverdue(task, { workDays }));
    const scheduledToday = open.filter(
      (task) => !isTaskOverdue(task, { workDays }) && hasOccurrenceToday(task, today, workDays)
    );
    const unscheduled = sortTasks(
      open.filter((task) => !getTaskStartDate(task) && !task.recurrence),
      workDays
    );
    const upcoming = sortTasks(
      open.filter((task) => {
        const start = getTaskStartDate(task);
        return start && start > today && !hasOccurrenceToday(task, today, workDays);
      }),
      workDays
    );
    const completed = tasks.filter((task) => isCompletedToday(task, todayIso));
    const candidates = sortTasks(open, workDays).sort((a, b) => {
      const rank = (task) => {
        if (isTaskOverdue(task, { workDays })) return 0;
        if (normalizeTaskStatus(task) === 'in_progress') return 1;
        if (hasOccurrenceToday(task, today, workDays)) return 2;
        if (getTaskStartDate(task)) return 3;
        return 4;
      };
      return rank(a) - rank(b) || compareTasksBySchedule(a, b, { workDays });
    });

    return { open, overdue, scheduledToday, unscheduled, upcoming, completed, candidates };
  }, [tasks, today, todayIso, workDays]);

  const planTasks = useMemo(
    () => planIds.map((id) => tasks.find((task) => task.id === id)).filter(Boolean),
    [planIds, tasks]
  );
  const planOpenTasks = planTasks.filter((task) => isEffectivelyOpen(task));
  const candidateTasks = daily.candidates.filter((task) => !planIds.includes(task.id));
  const visibleCandidates = showMoreCandidates ? candidateTasks : candidateTasks.slice(0, 6);
  const dateLabel = today.toLocaleDateString('ar-EG', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const completedPlanCount = planTasks.filter((task) => !isEffectivelyOpen(task)).length;
  const firstTask = planOpenTasks[0];

  const persistPlan = (next) => {
    setPlanIds(next);
    try {
      localStorage.setItem(`${PLAN_STORAGE_PREFIX}${todayIso}`, JSON.stringify(next));
    } catch {
      // Local persistence is a convenience; the task data remains server-backed.
    }
  };

  const togglePlan = (taskId) => {
    if (planIds.includes(taskId)) {
      persistPlan(planIds.filter((id) => id !== taskId));
      return;
    }
    if (planIds.length >= PLAN_LIMIT) return;
    persistPlan([...planIds, taskId]);
  };

  return (
    <div className="today-view">
      <section className="today-command-center" aria-labelledby="today-title">
        <div className="today-command-copy">
          <p className="today-eyebrow">لوحة قيادة يومية</p>
          <h1 id="today-title">خطتك لليوم</h1>
          <p className="today-date">{dateLabel}</p>
          <p className="today-command-description">
            لا تحاول حمل كل المهام. اختر ثلاث نتائج مهمة، ثم نفّذها واحدة تلو الأخرى.
          </p>
        </div>
        <div className="today-command-actions">
          {firstTask ? (
            <button type="button" className="btn-primary today-start-btn" onClick={() => onSetStatus?.(firstTask.id, 'in_progress')}>
              <i className="ph ph-play" aria-hidden="true" />
              ابدأ المهمة الأولى
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={() => setMode('plan')}>
              <i className="ph ph-list-checks" aria-hidden="true" />
              اختر أولوياتك
            </button>
          )}
          <button type="button" className="btn-secondary" onClick={onAddTask}>
            <i className="ph ph-plus" aria-hidden="true" />
            مهمة جديدة
          </button>
        </div>
      </section>

      <nav className="today-mode-tabs" aria-label="تنظيم العمل">
        <button type="button" className={mode === 'plan' ? 'is-active' : ''} onClick={() => setMode('plan')}>
          <i className="ph ph-target" aria-hidden="true" />
          خطة اليوم
          <span>{planTasks.length}/{PLAN_LIMIT}</span>
        </button>
        <button type="button" className={mode === 'inbox' ? 'is-active' : ''} onClick={() => setMode('inbox')}>
          <i className="ph ph-tray" aria-hidden="true" />
          صندوق الفرز
          <span>{daily.unscheduled.length}</span>
        </button>
        <button type="button" className={mode === 'upcoming' ? 'is-active' : ''} onClick={() => setMode('upcoming')}>
          <i className="ph ph-calendar" aria-hidden="true" />
          القادم
          <span>{daily.upcoming.length}</span>
        </button>
      </nav>

      <div className="today-workspace-layout">
        <div className="today-primary-flow">
      {mode === 'plan' && (
        <>
          <section className="today-plan-intro">
            <div>
              <p className="today-section-kicker">قرار واحد قبل التنفيذ</p>
              <h2>{planTasks.length < PLAN_LIMIT ? 'اختر ما يستحق وقتك اليوم' : 'هذه هي قائمة تركيزك'}</h2>
              <p>
                {planTasks.length < PLAN_LIMIT
                  ? `اختر حتى ${PLAN_LIMIT} مهام من القائمة أدناه. المتأخر ليس تلقائيًا أولوية.`
                  : 'لا تظهر بقية التراكم هنا حتى لا تنافس عملك الحالي.'}
              </p>
            </div>
            <div className="today-plan-progress" aria-label={`أنجزت ${completedPlanCount} من ${planTasks.length}`}>
              <strong>{completedPlanCount}/{planTasks.length}</strong>
              <span>من خطة اليوم</span>
            </div>
          </section>

          {planTasks.length > 0 && (
            <section className="today-focus-section" aria-labelledby="today-focus-title">
              <div className="today-section-heading">
                <div>
                  <p className="today-section-kicker">نفّذ بالترتيب</p>
                  <h2 id="today-focus-title">أولويات اليوم</h2>
                </div>
                <span className="today-focus-count">{planTasks.length} من {PLAN_LIMIT}</span>
              </div>
              <div className="today-task-list">
                {planTasks.map((task) => (
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
          )}

          <section className="today-candidates-section" aria-labelledby="today-candidates-title">
            <div className="today-section-heading compact">
              <div>
                <p className="today-section-kicker">من كل ما ينتظرك</p>
                <h2 id="today-candidates-title">ماذا تختار؟</h2>
              </div>
              <span className="today-candidate-hint">{daily.overdue.length} متأخرة · {daily.scheduledToday.length} اليوم</span>
            </div>
            {visibleCandidates.length > 0 ? (
              <div className="today-candidate-list">
                {visibleCandidates.map((task) => (
                  <TaskCandidate
                    key={task.id}
                    task={task}
                    selected={planIds.includes(task.id)}
                    disabled={planIds.length >= PLAN_LIMIT}
                    onAdd={togglePlan}
                    onEdit={onEdit}
                    workDays={workDays}
                    workspaces={workspaces}
                    projects={projects}
                  />
                ))}
              </div>
            ) : (
              <EmptyState
                icon="ph-sparkle"
                title="لا توجد مهام مفتوحة للاختيار"
                hint="أضف مهمة جديدة أو راجع المهام المؤرشفة لاستعادة سياق سابق."
                actionLabel="إضافة مهمة"
                onAction={onAddTask}
              />
            )}
            {candidateTasks.length > 6 && (
              <button type="button" className="today-more-button" onClick={() => setShowMoreCandidates((value) => !value)}>
                {showMoreCandidates ? 'عرض عدد أقل' : `عرض ${candidateTasks.length - 6} مهام أخرى`}
              </button>
            )}
          </section>
        </>
      )}

      {mode === 'inbox' && (
        <section className="today-secondary-panel" aria-labelledby="today-inbox-title">
          <div className="today-panel-heading">
            <div>
              <p className="today-section-kicker">التقاط قبل التخطيط</p>
              <h2 id="today-inbox-title">صندوق الفرز</h2>
              <p>هذه مهام موجودة، لكنها بلا موعد أو قرار زمني. لا تجعلها تظهر تلقائيًا في خطة اليوم.</p>
            </div>
            <button type="button" className="btn-secondary" onClick={onAddTask}>
              <i className="ph ph-plus" aria-hidden="true" />
              التقاط فكرة
            </button>
          </div>
          {daily.unscheduled.length > 0 ? (
            <div className="today-candidate-list">
              {daily.unscheduled.map((task) => (
                <TaskCandidate
                  key={task.id}
                  task={task}
                  selected={planIds.includes(task.id)}
                  disabled={planIds.length >= PLAN_LIMIT}
                  onAdd={togglePlan}
                  onEdit={onEdit}
                  workDays={workDays}
                  workspaces={workspaces}
                  projects={projects}
                />
              ))}
            </div>
          ) : (
            <EmptyState icon="ph-tray" title="صندوق الفرز فارغ" hint="كل المهام المفتوحة لديها موعد أو أصبحت ضمن خطة اليوم." actionLabel="إضافة مهمة" onAction={onAddTask} />
          )}
        </section>
      )}

      {mode === 'upcoming' && (
        <section className="today-secondary-panel" aria-labelledby="today-upcoming-title">
          <div className="today-panel-heading">
            <div>
              <p className="today-section-kicker">حتى لا تفاجئك المهام</p>
              <h2 id="today-upcoming-title">الأجندة القادمة</h2>
              <p>ما له موعد قادم يبقى خارج خطة اليوم حتى يحين وقته.</p>
            </div>
            <button type="button" className="text-button" onClick={onOpenAllTasks}>فتح كل المهام <i className="ph ph-arrow-left" aria-hidden="true" /></button>
          </div>
          {daily.upcoming.length > 0 ? (
            <div className="today-candidate-list">
              {daily.upcoming.map((task) => (
                <TaskCandidate key={task.id} task={task} selected={false} disabled={false} onAdd={togglePlan} onEdit={onEdit} workDays={workDays} workspaces={workspaces} projects={projects} />
              ))}
            </div>
          ) : (
            <EmptyState icon="ph-calendar-check" title="لا توجد مهام قادمة" hint="خطط مهمة للمستقبل من تفاصيل أي مهمة عندما تكون جاهزًا." actionLabel="فتح كل المهام" onAction={onOpenAllTasks} />
          )}
        </section>
      )}

      <button type="button" className="today-all-link" onClick={onOpenAllTasks}>
        <i className="ph ph-squares-four" aria-hidden="true" />
        فتح مساحة العمل الكاملة والفلاتر
      </button>
        </div>
        <MiniCalendar tasks={tasks} today={today} workDays={workDays} projects={projects} />
      </div>
    </div>
  );
}
