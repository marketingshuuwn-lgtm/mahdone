import { useEffect, useState } from 'react';
import Modal from './ui/Modal';
import { DEFAULT_WORKSPACES } from '../utils/taskMeta';

const EMPTY = { name: '', context: 'work', description: '', dueDate: '', color: '#159a76' };
const COLORS = ['#159a76', '#2563eb', '#7c3aed', '#ea580c', '#db2777', '#0f766e'];

export default function ProjectModal({ isOpen, onClose, onSave, defaultContext = 'work', workspaces = DEFAULT_WORKSPACES }) {
  const [form, setForm] = useState({ ...EMPTY, context: defaultContext });

  useEffect(() => {
    if (isOpen) setForm({ ...EMPTY, context: defaultContext });
  }, [isOpen, defaultContext]);

  const update = (patch) => setForm((current) => ({ ...current, ...patch }));
  const submit = (event) => {
    event.preventDefault();
    if (!form.name.trim()) return;
    onSave({ ...form, name: form.name.trim(), description: form.description.trim() });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} ariaLabel="إنشاء مشروع جديد" panelClassName="modal-box card project-composer-modal">
      <div className="modal-header project-composer-header">
        <div>
          <span className="project-composer-eyebrow">داخل مساحة العمل</span>
          <h3>إنشاء مشروع جديد</h3>
          <p>المشروع حاوية لها نتيجة وموعد. اختر مساحته أولًا حتى تبقى المهام في مكانها الصحيح.</p>
        </div>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق"><i className="ph ph-x" /></button>
      </div>

      <form className="project-composer-form" onSubmit={submit}>
        <div className="project-composer-callout"><i className="ph ph-folder-notch-open" /><span>المساحة الأكبر: <strong>{workspaces.find((space) => space.id === form.context)?.label || 'مساحة العمل'}</strong></span></div>
        <div className="form-field project-name-field">
          <label htmlFor="project-name">اسم المشروع</label>
          <input id="project-name" autoFocus required className="form-input" value={form.name} onChange={(e) => update({ name: e.target.value })} placeholder="مثال: إطلاق الموقع الجديد" />
        </div>
        <div className="form-row">
          <div className="form-field">
            <label>مساحة العمل</label>
            <select className="form-input" value={form.context} onChange={(e) => update({ context: e.target.value })}>
              {(workspaces.length ? workspaces : DEFAULT_WORKSPACES).map((space) => <option key={space.id} value={space.id}>{space.label}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label>موعد المشروع</label>
            <input type="date" className="form-input" value={form.dueDate} onChange={(e) => update({ dueDate: e.target.value })} />
          </div>
        </div>
        <div className="form-field">
          <label>المخرج الذي سيغلق المشروع</label>
          <textarea className="form-input" rows={3} value={form.description} onChange={(e) => update({ description: e.target.value })} placeholder="صف النتيجة النهائية التي يجب أن تكون جاهزة…" />
        </div>
        <div className="form-field">
          <label>لون المشروع</label>
          <div className="project-color-picker" role="radiogroup" aria-label="لون المشروع">
            {COLORS.map((color) => <button type="button" key={color} aria-label={color} className={form.color === color ? 'is-selected' : ''} style={{ '--project-color': color }} onClick={() => update({ color })}><span /></button>)}
          </div>
        </div>
        <div className="modal-footer">
          <button type="submit" className="btn-primary"><i className="ph ph-folder-plus" /> إنشاء المشروع</button>
          <button type="button" className="btn-secondary" onClick={onClose}>إلغاء</button>
        </div>
      </form>
    </Modal>
  );
}
