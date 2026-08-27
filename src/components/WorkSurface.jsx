import { useEffect, useMemo, useState } from 'react';
import {
  formatTaskSchedule,
  getOccurrenceDates,
  isTaskOverdue,
  startOfToday,
  toLocalISO,
} from '../utils/dateUtils';
import { getTaskContextMeta } from '../utils/taskMeta';
import { isEffectivelyOpen, normalizeTaskStatus } from '../utils/taskStatus';
import { getSubtaskStats, normalizeSubtasks } from '../utils/subtasks';
import AppFrame from './AppFrame';

function taskMatchesMode(task, mode, day, workDays, { includeBacklog = true } = {}) {
  const open = isEffectivelyOpen(task);
  const start = task.dueDate ? new Date(`${task.dueDate}T00:00:00`) : null;
  if (mode === 'all') return open;
  if (mode === 'inbox') return open && !task.dueDate && !task.recurrence;
  if (mode === 'upcoming') return open && start && start > day;
  if (mode === 'done') return !open;
  const occursOnSelectedDay = getOccurrenceDates(task, day, day, { workDays }).length > 0;
  if (!includeBacklog) return open && occursOnSelectedDay;
  return open && (isTaskOverdue(task, { workDays }) || occursOnSelectedDay || !task.dueDate);
}

function sameCalendarDay(a, b) {
  return toLocalISO(a) === toLocalISO(b);
}

function sortForWork(a, b, workDays, referenceDate) {
  const rank = (task) => {
    if (isTaskOverdue(task, { workDays })) return 0;
    if (normalizeTaskStatus(task) === 'in_progress') return 1;
    if (getOccurrenceDates(task, referenceDate, referenceDate, { workDays }).length) return 2;
    return 3;
  };
  return rank(a) - rank(b) || String(a.title).localeCompare(String(b.title), 'ar');
}

function TaskLine({ task, selected, onSelect, onSetStatus, workDays, workspaces, projects }) {
  const status = normalizeTaskStatus(task);
  const overdue = isTaskOverdue(task, { workDays });
  const context = getTaskContextMeta(task.context, workspaces);
  const project = projects.find((item) => item.id === task.projectId);
  const subtasks = getSubtaskStats(normalizeSubtasks(task.subtasks));
  const complete = status === 'completed';

  return (
    <div className={`work-line ${selected ? 'is-selected' : ''} ${complete ? 'is-complete' : ''}`} role="listitem">
      <button
        type="button"
        className={`work-line-check status-${status}`}
        onClick={() => onSetStatus?.(task.id, complete ? 'not_started' : 'completed')}
        aria-label={complete ? 'إلغاء إنجاز المهمة' : 'إنهاء المهمة'}
      >
        {complete && <i className="ph ph-check" />}
        {status === 'in_progress' && <i className="ph ph-play-circle" />}
      </button>
      <button type="button" className="work-line-main" onClick={() => onSelect(task.id)} aria-label={`فتح المهمة: ${task.title}`}>
        <span className="work-line-order" aria-hidden="true"><i className="ph ph-dots-six-vertical" /></span>
        <span className="work-line-copy">
          <strong>{task.title}</strong>
          <small>
            <span style={{ color: context.color }}>{context.label}</span>
            {project && <span>{project.name}</span>}
            {subtasks.total > 0 && <span>{subtasks.completed}/{subtasks.total} خطوات</span>}
          </small>
        </span>
        <span className="work-line-when">
          {overdue ? <b>متأخرة</b> : formatTaskSchedule(task, { workDays })}
        </span>
        <span className="work-line-open"><i className="ph ph-caret-left" /></span>
      </button>
    </div>
  );
}

function DetailPanel({ task, onEdit, onSetStatus, onToggleSubtask, workDays, projects }) {
  if (!task) {
    return (
      <aside className="work-detail work-detail-empty">
        <div className="detail-empty-icon"><i className="ph ph-cursor-click" /></div>
        <h2>اختر مهمة</h2>
        <p>ستظهر هنا النتيجة المطلوبة، الملاحظات، الخطوات، ورابط التسليم؛ بينما تبقى القائمة خفيفة.</p>
      </aside>
    );
  }

  const project = projects.find((item) => item.id === task.projectId);
  const subtasks = normalizeSubtasks(task.subtasks);
  const status = normalizeTaskStatus(task);
  const completed = subtasks.filter((item) => item.completed).length;

  return (
    <aside className="work-detail">
      <div className="work-detail-head">
        <span className="detail-label">المهمة المحددة</span>
        <button type="button" className="work-icon-button" onClick={() => onEdit(task.id)} aria-label="تعديل المهمة"><i className="ph ph-pencil-simple" /></button>
      </div>
      <h2>{task.title}</h2>
      <div className="detail-status-row">
        <button type="button" className={`detail-status status-${status}`} onClick={() => onSetStatus?.(task.id, status === 'completed' ? 'not_started' : 'completed')}>
          <i className={`ph ${status === 'completed' ? 'ph-check-circle' : status === 'in_progress' ? 'ph-play-circle' : 'ph-circle'}`} />
          {status === 'completed' ? 'مكتملة' : status === 'in_progress' ? 'قيد التنفيذ' : 'لم تبدأ'}
        </button>
        <span><i className="ph ph-calendar-blank" /> {formatTaskSchedule(task, { workDays })}</span>
      </div>

      <section className="detail-section">
        <span className="detail-label">المخرج المطلوب</span>
        <p className={task.deliverable ? '' : 'is-empty'}>{task.deliverable || 'لم يُحدد مخرج بعد. أضفه من تعديل المهمة حتى تعرف متى تنتهي فعليًا.'}</p>
        {task.deliverableUrl ? <a href={task.deliverableUrl} target="_blank" rel="noreferrer"><i className="ph ph-link" /> فتح رابط التسليم</a> : <button type="button" className="detail-output-action" onClick={() => onEdit(task.id)}><i className="ph ph-plus" /> إضافة المخرج</button>}
      </section>

      <section className="detail-section detail-meta-grid">
        <div><span>المساحة</span><strong>{task.context}</strong></div>
        <div><span>المشروع</span><strong>{project?.name || 'غير مصنف'}</strong></div>
        <div><span>المدة المتوقعة</span><strong>{task.duration || 1} يوم</strong></div>
      </section>

      <section className="detail-section">
        <div className="detail-section-title"><span className="detail-label">خطوات الإنجاز</span><small>{completed}/{subtasks.length}</small></div>
        {subtasks.length ? (
          <div className="detail-checklist">
            {subtasks.map((item) => (
              <button type="button" key={item.id} className={item.completed ? 'is-done' : ''} onClick={() => onToggleSubtask?.(task.id, item.id)}>
                <i className={`ph ${item.completed ? 'ph-check-square' : 'ph-square'}`} />{item.title}
              </button>
            ))}
          </div>
        ) : <p className="detail-muted">لا توجد خطوات؛ أضف checklist من تعديل المهمة.</p>}
      </section>

      <section className="detail-section"><div className="detail-section-title"><span className="detail-label">ملاحظات</span><button type="button" className="detail-inline-action" onClick={() => onEdit(task.id)}>{task.notes ? 'تعديل' : 'إضافة ملاحظة'}</button></div>{task.notes ? <p>{task.notes}</p> : <p className="detail-muted">أضف ملاحظتك أو آخر تقدم من تعديل المهمة.</p>}</section>
    </aside>
  );
}

function TimelineView({ tasks, anchorDate, onSelectTask, onShiftWindow, onGoToday, workDays, projects }) {
  const dayCount = 14;
  const start = new Date(anchorDate);
  start.setDate(start.getDate() - 3);
  start.setHours(0, 0, 0, 0);
  const days = Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return date;
  });
  const dayIndex = (date) => Math.round((startOfToday(date).getTime() - start.getTime()) / 86400000);
  const scheduled = tasks.filter((task) => task.dueDate && dayIndex(new Date(`${task.dueDate}T00:00:00`)) < dayCount && dayIndex(new Date(`${task.dueDate}T00:00:00`)) + Math.max(1, Number(task.duration) || 1) > 0);
  const unscheduled = tasks.filter((task) => !task.dueDate || !scheduled.some((item) => item.id === task.id));
  return (
    <section className="work-timeline" aria-label="الخط الزمني للمهام">
      <div className="timeline-head"><div><span className="work-eyebrow">عرض التخطيط</span><h2>الخط الزمني</h2><p>اقرأ تداخل الالتزامات قبل أن تضيف عملاً جديدًا.</p></div><div className="timeline-controls"><button type="button" onClick={() => onShiftWindow?.(-7)} aria-label="الفترة السابقة"><i className="ph ph-caret-right" /> السابقة</button><button type="button" onClick={onGoToday}>اليوم</button><button type="button" onClick={() => onShiftWindow?.(7)} aria-label="الفترة التالية">التالية <i className="ph ph-caret-left" /></button><span className="timeline-range">{start.toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })} — {days[days.length - 1].toLocaleDateString('ar-EG', { day: 'numeric', month: 'short' })}</span></div></div>
      <div className="timeline-scroll"><div className="timeline-grid" style={{ '--timeline-days': dayCount }}>
        <div className="timeline-corner">المهام</div>
        {days.map((day) => <div className={`timeline-day ${sameCalendarDay(day, startOfToday()) ? 'is-today' : ''}`} key={toLocalISO(day)}><small>{day.toLocaleDateString('ar-EG', { weekday: 'short' })}</small><strong>{day.getDate()}</strong></div>)}
        {scheduled.map((task) => {
          const startIndex = Math.max(0, dayIndex(new Date(`${task.dueDate}T00:00:00`)));
          const duration = Math.min(dayCount - startIndex, Math.max(1, Number(task.duration) || 1));
          const project = projects.find((item) => item.id === task.projectId);
          return <div className="timeline-task-row" key={task.id}><button type="button" className="timeline-task-label" onClick={() => onSelectTask(task.id)}><strong>{task.title}</strong><small>{project?.name || formatTaskSchedule(task, { workDays })}</small></button><button type="button" className={`timeline-bar ${isTaskOverdue(task, { workDays }) ? 'is-overdue' : ''}`} style={{ gridColumn: `${startIndex + 2} / span ${duration}` }} onClick={() => onSelectTask(task.id)}><span>{task.title}</span></button></div>;
        })}
      </div></div>
      {unscheduled.length > 0 && <div className="timeline-unscheduled"><span><i className="ph ph-calendar-x" /> غير مجدولة أو خارج النافذة</span><div>{unscheduled.slice(0, 8).map((task) => <button type="button" key={task.id} onClick={() => onSelectTask(task.id)}>{task.title}</button>)}</div></div>}
    </section>
  );
}

function WeekPanel({ tasks, today, selectedDate, onSelectDate, workDays }) {
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setDate(today.getDate() + index);
    const count = tasks.filter((task) => isEffectivelyOpen(task) && getOccurrenceDates(task, date, date, { workDays }).length > 0).length;
    return { date, count, today: index === 0 };
  });
  return (
    <section className="work-week-panel">
      <div className="work-panel-heading"><span>الأسبوع</span><i className="ph ph-calendar-blank" /></div>
      <div className="week-list">
        {days.map(({ date, count, today: isToday }) => (
          <button type="button" className={`${isToday ? 'is-today ' : ''}${sameCalendarDay(date, selectedDate) ? 'is-selected' : ''}`} key={toLocalISO(date)} onClick={() => onSelectDate(date)}>
            <span>{date.toLocaleDateString('ar-EG', { weekday: 'short' })}</span>
            <strong>{date.getDate()}</strong>
            <small>{count || '—'}</small>
          </button>
        ))}
      </div>
    </section>
  );
}

export default function WorkSurface({
  tasks,
  projects = [],
  workspaces = [],
  activeWorkspaceId,
  isAllMode,
  onSwitchWorkspace,
  onSwitchView,
  onAddTask,
  onEditTask,
  onSetStatus,
  onToggleSubtask,
  workDays,
  defaultMode = 'today',
}) {
  const today = useMemo(() => startOfToday(), []);
  const [mode, setMode] = useState(defaultMode);
  const [selectedId, setSelectedId] = useState(null);
  const [calendarDate, setCalendarDate] = useState(today);
  const [projectFilter, setProjectFilter] = useState('all');
  const [layout, setLayout] = useState('list');
  const selectedTask = tasks.find((task) => task.id === selectedId) || null;
  const scopedProjects = projects.filter((project) => isAllMode || project.context === activeWorkspaceId);
  const viewingToday = sameCalendarDay(calendarDate, today);
  const visible = useMemo(() => tasks
    .filter((task) => taskMatchesMode(task, mode, calendarDate, workDays, { includeBacklog: viewingToday }))
    .filter((task) => projectFilter === 'all' || task.projectId === projectFilter)
    .sort((a, b) => sortForWork(a, b, workDays, calendarDate)), [tasks, mode, calendarDate, workDays, projectFilter, viewingToday]);
  useEffect(() => {
    if (selectedId && !visible.some((task) => task.id === selectedId) && mode !== 'today') setSelectedId(null);
  }, [selectedId, visible, mode]);
  const scopedTasks = (source) => source.filter((task) => projectFilter === 'all' || task.projectId === projectFilter);
  const todayTasks = useMemo(() => scopedTasks(tasks.filter((task) => taskMatchesMode(task, 'today', calendarDate, workDays, { includeBacklog: false }) && !isTaskOverdue(task, { workDays }))).sort((a, b) => sortForWork(a, b, workDays, calendarDate)), [tasks, calendarDate, workDays, projectFilter]);
  const overdueTasks = useMemo(() => scopedTasks(tasks.filter((task) => isEffectivelyOpen(task) && isTaskOverdue(task, { workDays}))).sort((a, b) => sortForWork(a, b, workDays, calendarDate)), [tasks, workDays, projectFilter, calendarDate]);
  const unscheduledTasks = useMemo(() => scopedTasks(tasks.filter((task) => isEffectivelyOpen(task) && !task.dueDate && !task.recurrence)), [tasks, projectFilter]);
  const todayCount = todayTasks.length;
  const overdue = overdueTasks.length;
  const startNowTasks = todayTasks.slice(0, 1);
  const startNowIds = new Set(startNowTasks.map((task) => task.id));
  const laterTodayTasks = todayTasks.filter((task) => !startNowIds.has(task.id));
  const modeLabel = { all: 'كل المهام', today: viewingToday ? 'عمل اليوم' : `مهام ${calendarDate.toLocaleDateString('ar-EG', { weekday: 'long' })}`, inbox: 'صندوق الفرز', upcoming: 'القادم', done: 'المنجز' }[mode];

  return (
    <AppFrame
      view="Today"
      workspaces={workspaces}
      activeWorkspaceId={activeWorkspaceId}
      isAllMode={isAllMode}
      onSwitchWorkspace={(id) => { setProjectFilter('all'); onSwitchWorkspace(id); }}
      onSwitchView={onSwitchView}
      showWorkspaceContext
      contextExtra={(
        <div className="project-filter-control">
          <span className="project-filter-label">المشروع</span>
          <div className="project-pills">
            <button type="button" className={projectFilter === 'all' ? 'is-active' : ''} onClick={() => setProjectFilter('all')}>كل المشاريع</button>
            {scopedProjects.slice(0, 4).map((project) => <button type="button" key={project.id} className={projectFilter === project.id ? 'is-active' : ''} onClick={() => setProjectFilter(project.id)}><span style={{ background: project.color }} />{project.name}</button>)}
            {scopedProjects.length > 4 && <button type="button" className="project-more" onClick={() => onSwitchView('Projects')}>عرض المشاريع <i className="ph ph-arrow-left" /></button>}
          </div>
        </div>
      )}
    >
      <main className="radical-workspace">
        <section className="work-main">
          <div className="work-heading">
            <div><span className="work-eyebrow">{calendarDate.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long' })}</span><h1>{modeLabel}</h1></div>
            <button type="button" className="work-add-button" onClick={onAddTask}><i className="ph ph-plus" /> مهمة جديدة</button>
          </div>
          <div className="work-toolbar">
            <div className="work-mode-tabs">{[['all', 'كل المهام'], ['today', `اليوم ${todayCount}`], ['inbox', 'صندوق الفرز'], ['upcoming', 'القادم'], ['done', 'المنجز']].map(([id, label]) => <button type="button" key={id} className={mode === id ? 'is-active' : ''} onClick={() => setMode(id)}>{label}</button>)}</div>
            <div className="work-layout-switcher"><button type="button" className={layout === 'list' ? 'is-active' : ''} onClick={() => setLayout('list')} title="عرض القائمة"><i className="ph ph-list-bullets" /></button><button type="button" className={layout === 'timeline' ? 'is-active' : ''} onClick={() => setLayout('timeline')} title="عرض الخط الزمني"><i className="ph ph-calendar-dots" /></button></div>
            <span className="work-toolbar-summary">{overdue ? `${overdue} متأخرة` : 'لا توجد مهام متأخرة'}</span>
          </div>
          {layout === 'list' && <><div className="work-quick-entry"><i className="ph ph-lightning" /><button type="button" onClick={onAddTask}>التقط مهمة أو فكرة بسرعة…</button><span>⌘ + K</span></div>
          {mode === 'today' && viewingToday ? (
            <div className="work-day-groups">
              {[
                ['ابدأ الآن', 'المهمة التي تستحق انتباهك أولًا.', startNowTasks],
                ['لاحقًا اليوم', 'مهام اليوم الأخرى بعد الأولوية الحالية.', laterTodayTasks],
                ['متأخرة تحتاج قرارًا', 'اختر نقلها لليوم أو تأجيلها بدل تركها تختلط بالعمل الحالي.', overdueTasks],
                ['غير مجدولة', 'التقطها هنا ثم امنحها موعدًا بقرار صريح.', unscheduledTasks],
              ].map(([title, hint, groupTasks]) => groupTasks.length > 0 && <section className="work-task-group" key={title}>
                <div className="work-task-group-head"><div><h2>{title}</h2><p>{hint}</p></div><strong>{groupTasks.length}</strong></div>
                <div className="work-lines" role="list">{groupTasks.map((task) => <TaskLine key={task.id} task={task} selected={task.id === selectedId} onSelect={setSelectedId} onSetStatus={onSetStatus} workDays={workDays} workspaces={workspaces} projects={projects} />)}</div>
              </section>)}
              {!todayTasks.length && !overdueTasks.length && !unscheduledTasks.length && <div className="work-empty"><i className="ph ph-check-circle" /><strong>لا توجد مهام مقررة لهذا اليوم</strong><span>يمكنك إضافة مهمة جديدة أو مراجعة صندوق الفرز.</span></div>}
            </div>
          ) : (
            <div className="work-lines" role="list">
              {visible.length ? visible.map((task) => <TaskLine key={task.id} task={task} selected={task.id === selectedId} onSelect={setSelectedId} onSetStatus={onSetStatus} workDays={workDays} workspaces={workspaces} projects={projects} />) : <div className="work-empty"><i className="ph ph-check-circle" /><strong>المساحة هادئة</strong><span>لا توجد مهام في هذا العرض حاليًا.</span></div>}
            </div>
          )}</>}
          {layout === 'timeline' && <TimelineView tasks={visible} anchorDate={calendarDate} onSelectTask={setSelectedId} onShiftWindow={(days) => setCalendarDate((current) => { const next = new Date(current); next.setDate(next.getDate() + days); return next; })} onGoToday={() => { setCalendarDate(today); setMode('today'); }} workDays={workDays} projects={projects} />}
        </section>
        <aside className="work-right-rail"><DetailPanel task={selectedTask} onEdit={onEditTask} onSetStatus={onSetStatus} onToggleSubtask={onToggleSubtask} workDays={workDays} projects={projects} /><WeekPanel tasks={tasks} today={today} selectedDate={calendarDate} onSelectDate={(date) => { setCalendarDate(date); setMode('today'); }} workDays={workDays} /></aside>
      </main>
    </AppFrame>
  );
}
