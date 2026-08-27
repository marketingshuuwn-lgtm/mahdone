import { useState } from 'react';
import TaskCard from './TaskCard';

const QUADRANTS = [
  { id: 'important-urgent', label: 'مهم ومستعجل' },
  { id: 'important-not-urgent', label: 'مهم غير مستعجل' },
  { id: 'not-important-urgent', label: 'غير مهم ومستعجل' },
  { id: 'not-important-not-urgent', label: 'غير مهم غير مستعجل' },
];

function AttachmentLinks({ task }) {
  const attachments = task.externalMeta?.attachments || [];
  if (!attachments.length) return null;
  return (
    <div className="trello-attachments">
      <span className="trello-muted" style={{ marginLeft: 6 }}>
        <i className="ph ph-paperclip"></i> مرفقات:
      </span>
      {attachments.map((a) => (
        <a
          key={a.id || a.url}
          href={a.url}
          target="_blank"
          rel="noreferrer"
          className="trello-link"
          title={a.name}
        >
          {a.name || 'مرفق'}
        </a>
      ))}
    </div>
  );
}

function TrelloTaskRow({
  task,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onMoveTask,
  workDays,
  showQuadrantSelect,
}) {
  return (
    <div className="trello-inbox-item">
      <TaskCard
        task={task}
        onToggleComplete={onToggleComplete}
        onSetStatus={onSetStatus}
        onToggleSubtask={onToggleSubtask}
        onEdit={onEdit}
        onDelete={onDelete}
        draggable={false}
        workDays={workDays}
      />
      <div className="trello-item-meta">
        {task.externalUrl && (
          <a href={task.externalUrl} target="_blank" rel="noreferrer" className="trello-link">
            <i className="ph ph-arrow-square-out"></i>
            فتح في تريلو
          </a>
        )}
        <AttachmentLinks task={task} />
        {showQuadrantSelect && (
          <select
            className="form-input trello-quad-select"
            value={task.quadrant}
            onChange={(e) => onMoveTask(task.id, e.target.value)}
            title="نقل إلى ربع"
          >
            {QUADRANTS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}

export default function TrelloView({
  tasks,
  trello,
  onToggleComplete,
  onSetStatus,
  onToggleSubtask,
  onEdit,
  onDelete,
  onMoveTask,
  workDays,
}) {
  const [apiKey, setApiKey] = useState('');
  const [token, setToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const trelloTasks = tasks.filter((t) => t.externalSource === 'trello');
  const inbox = trelloTasks.filter((t) => !t.completed);
  const doneFromTrello = trelloTasks.filter((t) => t.completed);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!apiKey.trim() || !token.trim()) return;
    setSaving(true);
    setFormError('');
    try {
      await trello.saveCredentials(apiKey, token);
      setApiKey('');
      setToken('');
    } catch (err) {
      console.error(err);
      setFormError(err?.message || 'فشل الربط');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="trello-page">
      <div className="page-header">
        <h1 className="page-title">تريلو</h1>
        <p className="page-desc">
          بطاقاتك المسندة في تريلو تظهر هنا. إغلاق البطاقة في تريلو → تُعلَّم مكتملة في مهد بعد
          المزامنة. المرفقات تظهر كروابط.
        </p>
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <h2 className="kpi-section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <i className="ph ph-plugs-connected"></i>
          الربط
        </h2>

        {trello.isConnected ? (
          <div className="trello-connected">
            <div className="trello-status-row">
              <span className="connection-dot"></span>
              <span>مرتبط بتريلو</span>
              {trello.config?.last_sync_at && (
                <span className="trello-muted">
                  آخر مزامنة:{' '}
                  {new Date(trello.config.last_sync_at).toLocaleString('ar-EG')}
                </span>
              )}
            </div>
            <div className="trello-actions">
              <button
                type="button"
                className="btn-primary"
                disabled={trello.syncing}
                onClick={() => trello.syncNow()}
              >
                <i className={`ph ${trello.syncing ? 'ph-spinner' : 'ph-arrows-clockwise'}`}></i>
                {trello.syncing ? 'جاري المزامنة…' : 'مزامنة الآن'}
              </button>
              <button type="button" className="btn-secondary" onClick={() => trello.disconnect()}>
                قطع الربط
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="trello-form">
            <p className="trello-muted" style={{ marginBottom: 16 }}>
              1) من{' '}
              <a href="https://trello.com/power-ups/admin" target="_blank" rel="noreferrer">
                Trello Power-Ups Admin
              </a>{' '}
              انسخ <strong>API Key</strong> فقط (ليس Secret).
              <br />
              2) أنشئ <strong>Token</strong> من رابط التفويض تحت الـ Key — الصقه في الحقل الثاني.
            </p>
            <div className="form-field">
              <label>API Key</label>
              <input
                type="password"
                className="form-input"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="form-field">
              <label>Token (وليس Secret)</label>
              <input
                type="password"
                className="form-input"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                autoComplete="off"
                required
              />
            </div>
            {formError && (
              <p style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }} role="alert">
                {formError}
              </p>
            )}
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'جاري التحقق…' : 'حفظ وربط'}
            </button>
          </form>
        )}
      </div>

      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 className="kpi-section-title" style={{ marginBottom: 0 }}>
            وارد تريلو (مفتوحة)
            <span className="q-count" style={{ marginRight: 10 }}>
              {inbox.length}
            </span>
          </h2>
        </div>

        {inbox.length === 0 ? (
          <div className="empty-state">
            {trello.isConnected
              ? 'لا بطاقات مسندة مفتوحة — اضغط «مزامنة الآن» بعد إسناد بطاقة في تريلو'
              : 'اربط تريلو أولاً ثم زامن'}
          </div>
        ) : (
          <div className="trello-inbox-list">
            {inbox.map((task) => (
              <TrelloTaskRow
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onSetStatus={onSetStatus}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveTask={onMoveTask}
                workDays={workDays}
                showQuadrantSelect
              />
            ))}
          </div>
        )}
      </div>

      {doneFromTrello.length > 0 && (
        <div className="card">
          <h2 className="kpi-section-title">
            مكتملة من تريلو / مهد
            <span className="q-count" style={{ marginRight: 10 }}>
              {doneFromTrello.length}
            </span>
          </h2>
          <p className="trello-muted" style={{ marginBottom: 12 }}>
            بعد إغلاق البطاقة في تريلو والمزامنة، تنتقل المهمة هنا وتُعلَّم مكتملة في مساحة عمل.
          </p>
          <div className="trello-inbox-list">
            {doneFromTrello.map((task) => (
              <TrelloTaskRow
                key={task.id}
                task={task}
                onToggleComplete={onToggleComplete}
                onSetStatus={onSetStatus}
                onToggleSubtask={onToggleSubtask}
                onEdit={onEdit}
                onDelete={onDelete}
                onMoveTask={onMoveTask}
                workDays={workDays}
                showQuadrantSelect={false}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
