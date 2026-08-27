import { useEffect, useRef, useState } from 'react';
import { marked } from 'marked';
import { useTaskNotes } from '../hooks/useTaskNotes';
import Modal from './ui/Modal';

function slugify(text) {
  return (text || 'مسودة')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
}

function downloadMd(title, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(title)}.md`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function NotesModal({ isOpen, taskId, taskTitle, onClose, showToast }) {
  const { notes, loading, createNote, updateNote, deleteNote } = useTaskNotes(taskId, showToast);
  const [activeId, setActiveId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [mode, setMode] = useState('edit'); // 'edit' | 'preview'
  const saveTimer = useRef(null);

  const activeNote = notes.find((n) => n.id === activeId) || null;

  useEffect(() => {
    if (isOpen && notes.length > 0 && !activeId) {
      setActiveId(notes[0].id);
    }
    if (isOpen && notes.length === 0) {
      setActiveId(null);
    }
  }, [isOpen, notes, activeId]);

  useEffect(() => {
    if (activeNote) {
      setDraftTitle(activeNote.title);
      setDraftContent(activeNote.content_md);
    } else {
      setDraftTitle('');
      setDraftContent('');
    }
  }, [activeId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeNote) return;
    if (draftTitle === activeNote.title && draftContent === activeNote.content_md) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateNote(activeNote.id, { title: draftTitle || 'مسودة بدون عنوان', content_md: draftContent });
    }, 700);
    return () => clearTimeout(saveTimer.current);
  }, [draftTitle, draftContent]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCreate = async () => {
    const note = await createNote('مسودة جديدة');
    if (note) setActiveId(note.id);
  };

  const handleDelete = async (id) => {
    await deleteNote(id);
    if (activeId === id) setActiveId(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel={`المسودات والمراجع — ${taskTitle || ''}`}
      panelClassName="modal-box card notes-modal-box"
    >
      <div className="modal-header">
        <h3>
          المسودات والمراجع <span className="notes-modal-task-title">— {taskTitle}</span>
        </h3>
        <button type="button" className="btn-icon" onClick={onClose} aria-label="إغلاق">
          <i className="ph ph-x" style={{ fontSize: 20 }}></i>
        </button>
      </div>

      <div className="notes-modal-body">
        <aside className="notes-sidebar">
          <button type="button" className="btn-primary notes-new-btn" onClick={handleCreate}>
            <i className="ph ph-file-plus"></i> مسودة جديدة
          </button>
          {loading && <p className="notes-empty-hint">جاري التحميل…</p>}
          {!loading && notes.length === 0 && (
            <p className="notes-empty-hint">لا توجد مسودات بعد لهذي المهمة.</p>
          )}
          <div className="notes-list">
            {notes.map((n) => (
              <div
                key={n.id}
                className={`notes-list-item ${activeId === n.id ? 'active' : ''}`}
                onClick={() => setActiveId(n.id)}
              >
                <div className="notes-list-item-title">{n.title}</div>
                <button
                  type="button"
                  className="btn-icon danger notes-delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(n.id);
                  }}
                  title="حذف"
                >
                  <i className="ph ph-trash" style={{ fontSize: 14 }}></i>
                </button>
              </div>
            ))}
          </div>
        </aside>

        <div className="notes-editor">
          {!activeNote ? (
            <div className="notes-empty-state">
              <i className="ph ph-note-pencil" style={{ fontSize: 36 }}></i>
              <p>اختر مسودة أو أنشئ وحدة جديدة</p>
            </div>
          ) : (
            <>
              <input
                type="text"
                className="form-input notes-title-input"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="عنوان المسودة"
              />

              <div className="notes-toolbar">
                <div className="notes-mode-toggle">
                  <button
                    type="button"
                    className={`chip-btn ${mode === 'edit' ? 'active' : ''}`}
                    onClick={() => setMode('edit')}
                  >
                    <i className="ph ph-pencil-simple"></i> تحرير
                  </button>
                  <button
                    type="button"
                    className={`chip-btn ${mode === 'preview' ? 'active' : ''}`}
                    onClick={() => setMode('preview')}
                  >
                    <i className="ph ph-eye"></i> معاينة
                  </button>
                </div>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => downloadMd(draftTitle, draftContent)}
                >
                  <i className="ph ph-download-simple"></i> تنزيل .md
                </button>
              </div>

              {mode === 'edit' ? (
                <textarea
                  className="form-input notes-textarea"
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="اكتب هنا... يدعم صيغة Markdown (# عناوين، **عريض**، - نقاط، [رابط](url)...)"
                />
              ) : (
                <div
                  className="notes-preview"
                  dangerouslySetInnerHTML={{
                    __html: marked.parse(draftContent || '*لا يوجد محتوى بعد*'),
                  }}
                />
              )}
              <p className="notes-autosave-hint">يُحفظ تلقائياً أثناء الكتابة</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
