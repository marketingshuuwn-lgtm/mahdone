import { useState } from 'react';
import { formatDate } from '../utils/dateUtils';
import TaskCard from './TaskCard';

export default function TimelineView({
  tasks,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onReschedule,
  workDays,
}) {
  const [overKey, setOverKey] = useState(null);

  const groups = {};
  tasks.forEach((t) => {
    const key = t.dueDate || 'none';
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });

  const sortedKeys = Object.keys(groups).sort((a, b) => {
    if (a === 'none') return 1;
    if (b === 'none') return -1;
    return new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00');
  });

  const handleDrop = (e, key) => {
    e.preventDefault();
    setOverKey(null);
    const id = e.dataTransfer.getData('text/plain');
    if (!id || key === 'none') return;
    onReschedule?.(id, key);
  };

  return (
    <div className="card">
      <p className="gantt-hint" style={{ marginBottom: 20 }}>
        <i className="ph ph-hand-grabbing"></i>
        اسحب مهمة وأفلتها على يوم آخر لتغيير تاريخ بدايتها
      </p>
      {sortedKeys.length === 0 ? (
        <div className="empty-state">لا توجد مهام لعرضها في الخط الزمني</div>
      ) : (
        sortedKeys.map((key) => (
          <div
            key={key}
            className={`timeline-group ${overKey === key ? 'timeline-drop-over' : ''}`}
            onDragOver={(e) => {
              if (key === 'none') return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setOverKey(key);
            }}
            onDragLeave={() => setOverKey((k) => (k === key ? null : k))}
            onDrop={(e) => handleDrop(e, key)}
          >
            <div className="timeline-date">
              <i className="ph ph-calendar"></i>{' '}
              {key === 'none' ? 'بدون تاريخ' : formatDate(key)}
            </div>
            <div className="timeline-tasks">
              {groups[key].map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggleComplete={onToggleComplete}
                onSetStatus={onSetStatus}
                  onToggleSubtask={onToggleSubtask}
                  onEdit={onEdit}
                  onDelete={onDelete}
                  workDays={workDays}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
