import { useMemo, useState } from 'react';
import { getOccurrenceDates, isRecurringTask, toLocalISO } from '../utils/dateUtils';

const DAY_NAMES = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];

export default function GanttView({ tasks, onToggleComplete, onEdit, onReschedule, workDays }) {
  const [dragId, setDragId] = useState(null);
  const [overDay, setOverDay] = useState(null);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    return d;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);
        return { iso: toLocalISO(d), date: d };
      }),
    [today]
  );

  const windowEnd = useMemo(() => {
    const d = new Date(today);
    d.setDate(today.getDate() + 13);
    return d;
  }, [today]);

  const rows = tasks
    .map((t) => {
      const occ = getOccurrenceDates(t, today, windowEnd, { workDays });
      if (!occ.length) return null;
      const indices = occ
        .map((iso) => days.findIndex((d) => d.iso === iso))
        .filter((i) => i >= 0);
      if (!indices.length) return null;
      return { task: t, indices, recurring: isRecurringTask(t) };
    })
    .filter(Boolean);

  const dropOn = (e, iso) => {
    e.preventDefault();
    e.stopPropagation();
    const raw = e.dataTransfer.getData('text/plain') || String(dragId || '');
    setDragId(null);
    setOverDay(null);
    if (!raw) return;
    onReschedule(raw, iso);
  };

  return (
    <div className="card gantt-card">
      <p className="gantt-hint">
        <i className="ph ph-hand-grabbing"></i>
        المتكرر يظهر كنقاط في أيام التكرار فقط — المشروع المتصل يظهر شريطاً متواصلاً
      </p>

      <div className="gantt-scroll">
        <div className="gantt-table" style={{ minWidth: 1100 }}>
          <div className="gantt-head" style={{ gridTemplateColumns: `200px repeat(${days.length}, 1fr)` }}>
            <div className="gantt-name-col">المهمة</div>
            {days.map(({ iso, date }) => (
              <div
                key={iso}
                className={`gantt-day-head ${overDay === iso ? 'is-over' : ''}`}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  setOverDay(iso);
                }}
                onDrop={(e) => dropOn(e, iso)}
              >
                <span>{DAY_NAMES[date.getDay()]}</span>
                <small>
                  {date.getDate()}/{date.getMonth() + 1}
                </small>
              </div>
            ))}
          </div>

          {rows.length === 0 && (
            <div className="empty-state">لا مهام مجدولة في الأسابيع الظاهرة</div>
          )}

          {rows.map(({ task, indices, recurring }) => (
            <div
              key={task.id}
              className="gantt-line"
              style={{ gridTemplateColumns: '200px 1fr' }}
            >
              <div className="gantt-name-col">
                <button
                  type="button"
                  className={`task-checkbox ${task.completed ? 'checked' : ''}`}
                  style={{ width: 18, height: 18 }}
                  onClick={() => onToggleComplete(task.id)}
                >
                  {task.completed && <i className="ph ph-check" style={{ fontSize: 10 }}></i>}
                </button>
                <button type="button" className="gantt-title-btn" onClick={() => onEdit(task.id)}>
                  {task.title}
                  {recurring && (
                    <span className="gantt-recurring-badge" title="مهمة متكررة">
                      <i className="ph ph-arrows-clockwise"></i>
                    </span>
                  )}
                </button>
              </div>

              <div
                className="gantt-days-track"
                style={{ gridTemplateColumns: `repeat(${days.length}, 1fr)` }}
              >
                {days.map(({ iso }, i) => {
                  const isOcc = indices.includes(i);
                  // شريط متصل: من أول يوم لآخر يوم متتالي في indices للمشاريع فقط
                  let continuous = false;
                  let continuousWidth = 1;
                  if (!recurring && isOcc) {
                    const first = indices[0];
                    if (i === first) {
                      continuous = true;
                      continuousWidth = indices.length;
                    }
                  }

                  return (
                    <div
                      key={iso}
                      className={`gantt-cell ${overDay === iso && dragId ? 'is-over' : ''}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        setOverDay(iso);
                      }}
                      onDrop={(e) => dropOn(e, iso)}
                    >
                      {recurring && isOcc && (
                        <div
                          className={`gantt-pill gantt-pill-dot ${task.quadrant} ${task.completed ? 'done' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(task.id));
                            e.dataTransfer.effectAllowed = 'move';
                            setDragId(task.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverDay(null);
                          }}
                          title={task.title}
                        />
                      )}
                      {!recurring && continuous && (
                        <div
                          className={`gantt-pill ${task.quadrant} ${task.completed ? 'done' : ''}`}
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.setData('text/plain', String(task.id));
                            e.dataTransfer.effectAllowed = 'move';
                            setDragId(task.id);
                          }}
                          onDragEnd={() => {
                            setDragId(null);
                            setOverDay(null);
                          }}
                          style={{
                            width: `calc(${continuousWidth * 100}% - 6px)`,
                          }}
                          title="اسحب لتغيير تاريخ البداية"
                        >
                          {task.title}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
