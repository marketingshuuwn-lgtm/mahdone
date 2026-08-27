import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createSubtask, normalizeSubtasks } from '../utils/subtasks';
import {
  DEFAULT_WORKSPACES,
  WEEK_DAYS,
  formatWorkDays,
  normalizeTaskContext,
} from '../utils/taskMeta';
import Modal from './ui/Modal';

const DEFAULT_RECURRENCE_LIFETIME_DAYS = 365;
const DRAFT_PREFIX = 'mahd_task_draft_v1:';

const EMPTY_FORM = {
  title: '',
  quadrant: 'important-urgent',
  context: 'work',
  projectId: null,
  status: 'not_started',
  subtasks: [],
  dueDate: '',
  notes: '',
  duration: 1,
  recurrence: null,
  recurrenceDays: [],
  deliverable: '',
  deliverableUrl: '',
};

function draftKey(taskId) {
  return `${DRAFT_PREFIX}${taskId ?? 'new'}`;
}

function readDraft(taskId) {
  try {
    const raw = localStorage.getItem(draftKey(taskId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(taskId, form) {
  try {
    localStorage.setItem(
      draftKey(taskId),
      JSON.stringify({ form, savedAt: new Date().toISOString() })
    );
  } catch {
    /* ignore quota */
  }
}

function clearDraft(taskId) {
  try {
    localStorage.removeItem(draftKey(taskId));
  } catch {
    /* ignore */
  }
}

function formFromTask(task, defaultContext) {
  if (!task) {
    return { ...EMPTY_FORM, context: normalizeTaskContext(defaultContext) };
  }
  return {
    title: task.title || '',
    quadrant: task.quadrant,
    context: normalizeTaskContext(task.context),
    projectId: task.projectId || null,
    status: task.status || (task.completed ? 'completed' : 'not_started'),
    subtasks: normalizeSubtasks(task.subtasks),
    dueDate: task.dueDate || '',
    notes: task.notes || '',
    duration: task.duration || 1,
    recurrence: task.recurrence || null,
    recurrenceDays: task.recurrenceDays || [],
    deliverable: task.deliverable || '',
    deliverableUrl: task.deliverableUrl || '',
  };
}

function isDirty(form, baseline) {
  try {
    return JSON.stringify(form) !== JSON.stringify(baseline);
  } catch {
    return true;
  }
}

/** يمنع اختصارات الصفحة من ابتلاع المسافة أثناء الكتابة */
function stopKeys(e) {
  e.stopPropagation();
}

export default function TaskModal({
  isOpen,
  task,
  onClose,
  onSave,
  workDays,
  defaultContext = 'work',
  workspaces = DEFAULT_WORKSPACES,
  projects = [],
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [baseline, setBaseline] = useState(EMPTY_FORM);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [draftBanner, setDraftBanner] = useState(null);
  const [dragSubId, setDragSubId] = useState(null);
  const [overSubId, setOverSubId] = useState(null);
  const taskIdRef = useRef(null);
  const formRef = useRef(form);
  const baselineRef = useRef(baseline);

  formRef.current = form;
  baselineRef.current = baseline;
  taskIdRef.current = task?.id ?? null;

  const dirty = useMemo(() => isDirty(form, baseline), [form, baseline]);

  useEffect(() => {
    if (!isOpen) return;

    const base = formFromTask(task, defaultContext);
    const draft = readDraft(task?.id ?? null);

    if (draft?.form && isDirty(draft.form, base)) {
      setForm({
        ...base,
        ...draft.form,
        subtasks: Array.isArray(draft.form.subtasks)
          ? draft.form.subtasks
          : base.subtasks,
      });
      setBaseline(base);
      setDraftBanner({
        savedAt: draft.savedAt,
        message: 'وُجدت مسودة غير محفوظة لهذه المهمة',
      });
    } else {
      setForm(base);
      setBaseline(base);
      setDraftBanner(null);
    }
    setNewSubtaskTitle('');
  }, [task, isOpen, defaultContext]);

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!dirty) return undefined;

    const t = setTimeout(() => {
      writeDraft(taskIdRef.current, formRef.current);
      setDraftBanner((prev) => ({
        savedAt: new Date().toISOString(),
        message: prev?.message || 'مسودة محفوظة محلياً',
      }));
    }, 450);

    return () => clearTimeout(t);
  }, [form, dirty, isOpen]);

  const persistDraftAndClose = useCallback(() => {
    if (isDirty(formRef.current, baselineRef.current)) {
      writeDraft(taskIdRef.current, formRef.current);
    }
    onClose();
  }, [onClose]);

  const discardDraft = useCallback(() => {
    clearDraft(taskIdRef.current);
    const base = formFromTask(task, defaultContext);
    setForm(base);
    setBaseline(base);
    setDraftBanner(null);
    setNewSubtaskTitle('');
  }, [task, defaultContext]);

  const toggleDay = (dayId) => {
    setForm((f) => {
      const has = f.recurrenceDays.includes(dayId);
      const recurrenceDays = has
        ? f.recurrenceDays.filter((d) => d !== dayId)
        : [...f.recurrenceDays, dayId].sort();
      return { ...f, recurrenceDays };
    });
  };

  const addSubtask = () => {
    const title = newSubtaskTitle;
    if (!title.trim()) return;
    setForm((f) => {
      const current = Array.isArray(f.subtasks) ? f.subtasks : [];
      return {
        ...f,
        subtasks: [
          ...current,
          { ...createSubtask(title), sortOrder: current.length },
        ],
      };
    });
    setNewSubtaskTitle('');
  };

  const updateSubtask = (subtaskId, patch) => {
    setForm((f) => ({
      ...f,
      subtasks: (Array.isArray(f.subtasks) ? f.subtasks : []).map((item) =>
        String(item.id) === String(subtaskId) ? { ...item, ...patch } : item
      ),
    }));
  };

  const removeSubtask = (subtaskId) => {
    setForm((f) => ({
      ...f,
      subtasks: (Array.isArray(f.subtasks) ? f.subtasks : []).filter(
        (item) => String(item.id) !== String(subtaskId)
      ),
    }));
  };

  const reorderSubtasks = (fromId, toId) => {
    if (fromId == null || toId == null || String(fromId) === String(toId)) return;
    setForm((f) => {
      const list = [...(Array.isArray(f.subtasks) ? f.subtasks : [])];
      const from = list.findIndex((item) => String(item.id) === String(fromId));
      const to = list.findIndex((item) => String(item.id) === String(toId));
      if (from < 0 || to < 0 || from === to) return f;
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return {
        ...f,
        subtasks: list.map((item, index) => ({ ...item, sortOrder: index })),
      };
    });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const title = form.title.trim();
    if (!title) return;
    const duration = Math.max(1, parseInt(form.duration, 10) || 1);
    clearDraft(task?.id ?? null);
    setDraftBanner(null);
    onSave(
      {
        ...form,
        title,
        duration,
        context: normalizeTaskContext(form.context),
        subtasks: normalizeSubtasks(form.subtasks, { forSave: true }),
        recurrence: form.recurrence || null,
        recurrenceDays: form.recurrence === 'weekly' ? form.recurrenceDays : [],
      },
      task?.id ?? null
    );
  };

  const isRecurring = form.recurrence === 'daily' || form.recurrence === 'weekly';
  const spaceOptions = workspaces?.length ? workspaces : DEFAULT_WORKSPACES;
  const projectOptions = projects.filter((project) => project.context === form.context && !project.archived);
  const subtasksList = Array.isArray(form.subtasks) ? form.subtasks : [];

  return (
    <Modal
      isOpen={isOpen}
      onClose={persistDraftAndClose}
      ariaLabel={task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}
      panelClassName="modal-box card task-composer-modal"
      onPanelKeyDown={stopKeys}
    >
      <div className="modal-header task-composer-header">
        <div>
          <span className="task-composer-eyebrow">{task ? 'تحديث مسار العمل' : 'التقاط ثم تنظيم'}</span>
          <h3>{task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</h3>
          <p className="task-composer-subtitle">ابدأ بما يجب إنجازه، ثم حدّد المساحة والمشروع والمخرج دون ملء نموذج طويل دفعة واحدة.</p>
        </div>
        <button
          type="button"
          className="btn-icon"
          onClick={persistDraftAndClose}
          title="إغلاق (تُحفظ مسودة إن وُجد تعديل)"
          aria-label="إغلاق"
        >
          <i className="ph ph-x" style={{ fontSize: 20 }}></i>
        </button>
      </div>

      {draftBanner && (
        <div className="task-draft-banner" role="status">
          <div className="task-draft-banner-text">
            <i className="ph ph-floppy-disk" />
            <span>
              {draftBanner.message}
              {dirty ? ' · تُحدَّث تلقائياً أثناء الكتابة' : ''}
            </span>
          </div>
          <div className="task-draft-banner-actions">
            <button type="button" className="btn-secondary" onClick={discardDraft}>
              تجاهل المسودة
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="task-composer-step task-composer-step-primary form-field">
          <div className="task-step-label"><span>01</span><div><label>ما الذي يجب إنجازه؟</label><small>صياغة واضحة يمكن تحويلها إلى نتيجة</small></div></div>
          <input
            type="text"
            className="form-input task-title-input"
            required
            autoFocus
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            onKeyDown={stopKeys}
          />
        </div>

        <div className="task-composer-context-block">
          <div className="task-step-label"><span>02</span><div><label>كيف ستُرتَّب؟</label><small>الأولوية والمساحة التي ستستقبل المهمة</small></div></div>
          <div className="form-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label>الأولوية</label>
            <select
              className="form-input"
              value={form.quadrant}
              onChange={(e) => setForm({ ...form, quadrant: e.target.value })}
            >
              <option value="important-urgent">مهم ومستعجل</option>
              <option value="important-not-urgent">مهم غير مستعجل</option>
              <option value="not-important-urgent">غير مهم ومستعجل</option>
              <option value="not-important-not-urgent">غير مهم غير مستعجل</option>
            </select>
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label>المساحة</label>
            <select
              className="form-input"
              value={form.context}
              onChange={(e) => setForm({ ...form, context: e.target.value })}
            >
              {spaceOptions.map((ctx) => (
                <option key={ctx.id} value={ctx.id}>
                  {ctx.label}
                </option>
              ))}
            </select>
          </div>
          </div>
        </div>

        <div className="task-composer-step task-composer-step-context form-field">
          <div className="task-step-label"><span>03</span><div><label>المشروع</label><small>أين ستظهر المهمة داخل المساحة؟</small></div></div>
          <select className="form-input" value={form.projectId || ''} onChange={(e) => setForm({ ...form, projectId: e.target.value || null })}>
            <option value="">بدون مشروع — يحتاج فرزًا لاحقًا</option>
            {projectOptions.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
          <p className="form-hint">اربط المهمة بالمشروع الذي سيستقبل مخرجها، ولا تستخدم المساحة كبديل عن المشروع.</p>
        </div>

        <div className="form-field">
          <label>المرحلة</label>
          <div className="recurrence-options">
            {[
              { id: 'not_started', label: 'لم تبدأ', icon: 'ph-circle' },
              { id: 'in_progress', label: 'قيد التنفيذ', icon: 'ph-circle-half' },
              { id: 'completed', label: 'مكتملة', icon: 'ph-check-circle' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className={`chip-btn ${form.status === s.id ? 'active' : ''}`}
                onClick={() => setForm({ ...form, status: s.id })}
              >
                <i className={`ph ${s.icon}`}></i> {s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-field">
          <label>التكرار</label>
          <div className="recurrence-options">
            {[
              { id: null, label: 'مرة واحدة' },
              { id: 'daily', label: 'يومياً' },
              { id: 'weekly', label: 'أيام محددة أسبوعياً' },
            ].map((opt) => (
              <button
                key={String(opt.id)}
                type="button"
                className={`chip-btn ${(form.recurrence || null) === opt.id ? 'active' : ''}`}
                onClick={() => {
                  const wasRecurring =
                    form.recurrence === 'daily' || form.recurrence === 'weekly';
                  const willBeRecurring = opt.id === 'daily' || opt.id === 'weekly';
                  const nextDuration =
                    !wasRecurring && willBeRecurring && Number(form.duration) <= 1
                      ? DEFAULT_RECURRENCE_LIFETIME_DAYS
                      : form.duration;
                  const nextRecurrenceDays =
                    opt.id === 'weekly' && form.recurrenceDays.length === 0
                      ? [...workDays]
                      : opt.id === 'weekly'
                        ? form.recurrenceDays
                        : [];
                  setForm({
                    ...form,
                    recurrence: opt.id,
                    duration: nextDuration,
                    recurrenceDays: nextRecurrenceDays,
                  });
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {form.recurrence === 'weekly' && (
            <div className="weekday-picks">
              {WEEK_DAYS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  className={`chip-btn ${form.recurrenceDays.includes(d.id) ? 'active' : ''}`}
                  onClick={() => toggleDay(d.id)}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}
          {form.recurrence === 'daily' && (
            <p className="form-hint">
              تظهر يومياً في أيام العمل المحددة من الإعدادات: {formatWorkDays(workDays)}
            </p>
          )}
          {form.recurrence === 'weekly' && (
            <p className="form-hint">
              تظهر فقط في الأيام المحددة، وخلال مدة العمر فقط — لا تكرار بلا نهاية
            </p>
          )}
        </div>

        <div className="form-row">
          <div className="form-field" style={{ flex: 1 }}>
            <label>{isRecurring ? 'تاريخ بداية السلسلة' : 'تاريخ البداية'}</label>
            <input
              type="date"
              className="form-input"
              value={form.dueDate}
              onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
            />
          </div>
          <div className="form-field" style={{ flex: 1 }}>
            <label>{isRecurring ? 'مدة التكرار (بالأيام)' : 'مدة المشروع (أيام متصلة)'}</label>
            <input
              type="number"
              min="1"
              className="form-input"
              value={form.duration}
              onChange={(e) => setForm({ ...form, duration: e.target.value })}
            />
            <p className="form-hint">
              {isRecurring
                ? 'تُنشأ نسخة في الأيام المحددة طوال هذه المدة، ثم يتوقف التكرار.'
                : 'عدد الأيام المتصلة التي تغطيها المهمة'}
            </p>
            {isRecurring && Number(form.duration) <= 1 && (
              <p className="form-hint" style={{ color: 'var(--danger)', fontWeight: 700 }}>
                بهذه القيمة ستظهر المهمة مرة واحدة فقط. ارفع المدة إلى عدد الأيام الذي تحتاجه،
                مثل 365 للتكرار السنوي.
              </p>
            )}
          </div>
        </div>

        <div className="task-composer-step task-composer-step-output form-field">
          <div className="task-step-label"><span>04</span><div><label>المخرج المتوقع</label><small>ما الشيء الذي سيكون جاهزًا عند الإنهاء؟</small></div></div>
          <textarea className="form-input" rows={2} value={form.deliverable} onChange={(e) => setForm({ ...form, deliverable: e.target.value })} placeholder="ما الشيء الذي سيكون جاهزًا عند إنهاء المهمة؟" />
        </div>

        <div className="form-field">
          <label>رابط التسليم أو المخرج</label>
          <input type="url" className="form-input" value={form.deliverableUrl} onChange={(e) => setForm({ ...form, deliverableUrl: e.target.value })} placeholder="https://…" dir="ltr" />
        </div>

        <div className="form-field">
          <label>ملاحظات</label>
          <textarea
            className="form-input"
            rows={3}
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            onKeyDown={stopKeys}
          />
        </div>

        <div className="form-field">
          <label>
            مهام فرعية / Checklist{' '}
            <span className="form-hint-inline">· اسحب ≡ للترتيب</span>
          </label>
          <div className="subtask-editor-list">
            {subtasksList.length === 0 ? (
              <div className="subtask-empty-hint">أضف خطوات صغيرة لتوضيح الإنجاز.</div>
            ) : (
              subtasksList.map((item) => (
                <div
                  key={item.id}
                  className={`subtask-editor-row${
                    dragSubId != null && String(dragSubId) === String(item.id)
                      ? ' is-dragging'
                      : ''
                  }${
                    overSubId != null &&
                    String(overSubId) === String(item.id) &&
                    String(dragSubId) !== String(item.id)
                      ? ' is-drag-over'
                      : ''
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragSubId != null && String(dragSubId) !== String(item.id)) {
                      setOverSubId(item.id);
                    }
                  }}
                  onDragLeave={() => {
                    setOverSubId((cur) =>
                      cur != null && String(cur) === String(item.id) ? null : cur
                    );
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const fromId = e.dataTransfer.getData('text/plain') || dragSubId;
                    reorderSubtasks(fromId, item.id);
                    setDragSubId(null);
                    setOverSubId(null);
                  }}
                >
                  <button
                    type="button"
                    className="subtask-drag-handle"
                    draggable
                    title="اسحب لإعادة الترتيب"
                    aria-label="اسحب لإعادة الترتيب"
                    onDragStart={(e) => {
                      e.dataTransfer.effectAllowed = 'move';
                      e.dataTransfer.setData('text/plain', String(item.id));
                      setDragSubId(item.id);
                    }}
                    onDragEnd={() => {
                      setDragSubId(null);
                      setOverSubId(null);
                    }}
                  >
                    <i className="ph ph-dots-six-vertical"></i>
                  </button>
                  <button
                    type="button"
                    className={`mini-check ${item.completed ? 'checked' : ''}`}
                    onClick={() => updateSubtask(item.id, { completed: !item.completed })}
                    title={item.completed ? 'إلغاء الإنجاز' : 'تحديد كمنجز'}
                  >
                    {item.completed && <i className="ph ph-check"></i>}
                  </button>
                  <input
                    type="text"
                    className="form-input subtask-input"
                    value={item.title}
                    onChange={(e) => updateSubtask(item.id, { title: e.target.value })}
                    onKeyDown={stopKeys}
                    placeholder="عنوان المهمة الفرعية"
                    autoComplete="off"
                  />
                  <button
                    type="button"
                    className="btn-icon danger"
                    onClick={() => removeSubtask(item.id)}
                    title="إزالة من القائمة"
                  >
                    <i className="ph ph-trash"></i>
                  </button>
                </div>
              ))
            )}
          </div>
          <div className="subtask-add-row">
            <input
              type="text"
              className="form-input"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              onKeyDown={(e) => {
                stopKeys(e);
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addSubtask();
                }
              }}
              placeholder="مثال: تجهيز العرض"
              autoComplete="off"
            />
            <button type="button" className="btn-secondary" onClick={addSubtask}>
              إضافة
            </button>
          </div>
        </div>

        <div className="modal-footer">
          <button type="submit" className="btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
            {task ? 'حفظ التعديلات' : 'إضافة المهمة'}
          </button>
          <button type="button" className="btn-secondary" onClick={persistDraftAndClose}>
            إغلاق
            {dirty ? ' · مسودة' : ''}
          </button>
        </div>
      </form>
    </Modal>
  );
}
