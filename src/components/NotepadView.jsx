import { useEffect, useMemo, useRef, useState } from 'react';
import { marked } from 'marked';
import { useStandaloneNotes } from '../hooks/useStandaloneNotes';
import PageHeader from './PageHeader';

const NOTE_TYPES = {
  note: { label: 'صفحة', icon: 'ph-note', title: 'صفحة جديدة' },
  checklist: { label: 'قائمة', icon: 'ph-list-checks', title: 'قائمة جديدة' },
  decision: { label: 'قرار', icon: 'ph-seal-check', title: 'قرار جديد' },
  reference: { label: 'مرجع', icon: 'ph-bookmark-simple', title: 'مرجع جديد' },
};
const BOARD_STAGES = [
  { id: 'capture', label: 'أفكار جديدة', hint: 'التقطها كما هي دون ترتيب', icon: 'ph-lightning' },
  { id: 'shape', label: 'أفكار قيد الترتيب', hint: 'وضّحها: ما المقصود؟ وما القرار؟', icon: 'ph-compass' },
  { id: 'next', label: 'جاهزة للتحويل', hint: 'حوّلها إلى مهمة أو احتفظ بها', icon: 'ph-arrow-left' },
];

const NOTE_GUIDANCE = {
  note: {
    eyebrow: 'صفحة للشرح',
    title: 'فرّغ ما في ذهنك الآن',
    hint: 'لا تقلق بشأن الترتيب، سجل السياق أو المسودة هنا لتصفيتها لاحقاً.',
    placeholder: 'ما الذي يشغل بالك؟ اكتبه هنا بكل حرية…',
  },
  checklist: {
    eyebrow: 'قائمة للإنجاز',
    title: 'فككها إلى خطوات تنفيذية',
    hint: 'المهام الكبيرة تصبح أسهل عندما تقسمها إلى أفعال بسيطة.',
    placeholder: 'ما هي الخطوة التالية؟ أضفها هنا…',
  },
  decision: {
    eyebrow: 'قرار للحسم',
    title: 'وثّق قرارك لتتوقف عن التفكير فيه',
    hint: 'سجل الخيارات والسبب لتتجنب إعادة التفكير في نفس الأمر مستقبلاً.',
    placeholder: 'الخيارات المتاحة:\\n\\nالقرار المتخذ:\\n\\nلماذا اخترنا هذا؟',
  },
  reference: {
    eyebrow: 'مرجع للعودة',
    title: 'احفظ ما ستحتاجه في المستقبل',
    hint: 'ضع الرابط والخلاصة لتعود إليها بسرعة عندما يحين وقت التنفيذ.',
    placeholder: 'رابط المرجع:\\n\\nما الفائدة الأساسية منه؟',
  },
};

function noteGuidance(type) {
  return NOTE_GUIDANCE[type] || NOTE_GUIDANCE.note;
}

function slugify(text) { return (text || 'مسودة').trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 60); }
function downloadMd(title, content) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${slugify(title)}.md`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
function notePreview(note) {
  if (note.note_type === 'checklist') {
    const list = Array.isArray(note.checklist) ? note.checklist : [];
    const done = list.filter((item) => item.completed).length;
    return list.length ? `${done}/${list.length} عناصر منجزة` : 'قائمة فارغة';
  }
  return (note.content_md || 'ابدأ بكتابة الفكرة…').replace(/[#*_`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}
function normalizeChecklist(items) {
  return Array.isArray(items) ? items.map((item) => ({ id: item.id || `${Date.now()}-${Math.random()}`, title: item.title || '', completed: Boolean(item.completed) })) : [];
}

export default function NotepadView({ showToast, onAddTask, onConvertToTask }) {
  const { notes, loading, createNote, updateNote, deleteNote } = useStandaloneNotes(showToast);
  const [activeId, setActiveId] = useState(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftContent, setDraftContent] = useState('');
  const [draftChecklist, setDraftChecklist] = useState([]);
  const [draftLabels, setDraftLabels] = useState([]);
  const [editorMode, setEditorMode] = useState('edit');
  const [workspaceMode, setWorkspaceMode] = useState('notes');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [newChecklistItem, setNewChecklistItem] = useState('');
  const saveTimer = useRef(null);
  const hydratedId = useRef(null);
  const activeNote = notes.find((note) => note.id === activeId) || null;
  const activeGuidance = noteGuidance(activeNote?.note_type);

  useEffect(() => {
    if (notes.length > 0 && !activeId) setActiveId(notes[0].id);
    if (notes.length === 0) setActiveId(null);
  }, [notes, activeId]);

  useEffect(() => {
    if (!activeNote || hydratedId.current === activeNote.id) return;
    hydratedId.current = activeNote.id;
    setDraftTitle(activeNote.title || '');
    setDraftContent(activeNote.content_md || '');
    setDraftChecklist(normalizeChecklist(activeNote.checklist));
    setDraftLabels(Array.isArray(activeNote.labels) ? activeNote.labels : []);
    setEditorMode('edit');
  }, [activeNote]);

  useEffect(() => {
    if (!activeNote || hydratedId.current !== activeNote.id) return undefined;
    const originalChecklist = JSON.stringify(normalizeChecklist(activeNote.checklist));
    const changed = draftTitle !== activeNote.title || draftContent !== activeNote.content_md || JSON.stringify(draftChecklist) !== originalChecklist || JSON.stringify(draftLabels) !== JSON.stringify(activeNote.labels || []);
    if (!changed) return undefined;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => updateNote(activeNote.id, { title: draftTitle || 'مسودة بدون عنوان', content_md: draftContent, checklist: draftChecklist, labels: draftLabels }), 600);
    return () => clearTimeout(saveTimer.current);
  }, [draftTitle, draftContent, draftChecklist, draftLabels, activeNote, updateNote]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        if (filter === 'pinned' && !note.is_pinned) return false;
        if (NOTE_TYPES[filter] && note.note_type !== filter) return false;
        if (q && !`${note.title || ''} ${note.content_md || ''} ${(note.labels || []).join(' ')}`.toLowerCase().includes(q)) return false;
        return true;
      })
      .sort((a, b) => Number(Boolean(b.is_pinned)) - Number(Boolean(a.is_pinned)) || new Date(b.updated_at) - new Date(a.updated_at));
  }, [notes, filter, query]);

  const labels = useMemo(() => [...new Set(notes.flatMap((note) => note.labels || []))].sort((a, b) => a.localeCompare(b, 'ar')), [notes]);
  const createForType = async (type = 'note') => {
    const note = await createNote(NOTE_TYPES[type].title, { noteType: type, boardStage: type === 'decision' ? 'shape' : 'capture' });
    if (note) {
      hydratedId.current = null;
      setActiveId(note.id);
      setWorkspaceMode('notes');
      setFilter('all');
    }
  };
  const updateMeta = (patch) => activeNote && updateNote(activeNote.id, patch);
  const toggleChecklistItem = (id) => setDraftChecklist((items) => items.map((item) => item.id === id ? { ...item, completed: !item.completed } : item));
  const addChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    setDraftChecklist((items) => [...items, { id: `${Date.now()}-${Math.random()}`, title: newChecklistItem.trim(), completed: false }]);
    setNewChecklistItem('');
  };
  const saveLabels = (value) => setDraftLabels([...new Set(value.split(',').map((label) => label.trim()).filter(Boolean))]);
  const moveBoardStage = (note, direction) => {
    const current = BOARD_STAGES.findIndex((stage) => stage.id === (note.board_stage || 'capture'));
    const target = BOARD_STAGES[current + direction];
    if (target) updateNote(note.id, { board_stage: target.id });
  };
  const handleDelete = async () => {
    if (!activeNote) return;
    const id = activeNote.id;
    const success = await deleteNote(id);
    if (success) {
      hydratedId.current = null;
      setActiveId(null);
    }
  };
  const convertToTask = () => {
    if (!activeNote || !onConvertToTask) return;
    const checklistNotes = activeNote.note_type === 'checklist'
      ? draftChecklist.map((item) => `- [${item.completed ? 'x' : ' '}] ${item.title}`).join('\\n')
      : '';
    onConvertToTask({
      title: draftTitle.trim() || activeNote.title || 'مهمة من المفكرة',
      notes: [draftContent.trim(), checklistNotes].filter(Boolean).join('\\n\\n'),
      subtasks: activeNote.note_type === 'checklist' ? draftChecklist : [],
      context: activeNote.context || undefined,
      projectId: activeNote.project_id || null,
    });
  };

  return (
    <div className="knowledge-page knowledge-page-v2">
      <PageHeader
        eyebrow="مساحة المعرفة"
        title="المفكرة"
        description="اكتب الفكرة، اختر شكلها المناسب، ثم حوّلها إلى مهمة عندما تصبح واضحة. لا تحتاج إلى ترتيبها من البداية."
        actions={<><button type="button" className="btn-secondary" onClick={() => setWorkspaceMode('board')}><i className="ph ph-kanban" /> كيف تتحرك الفكرة؟</button><button type="button" className="btn-primary" onClick={() => createForType('note')}><i className="ph ph-plus" /> ابدأ بفكرة</button></>}
        meta={<span>{loading ? 'جارٍ تحميل المعرفة…' : `${notes.length} عنصر معرفة`}</span>}
      />

      <div className="knowledge-how-it-works" aria-label="طريقة استخدام المفكرة">
        <div><strong><span>1</span> التقط</strong><small>سجل الفكرة فوراً</small></div>
        <i className="ph ph-arrow-left" aria-hidden="true" />
        <div><strong><span>2</span> وضّح</strong><small>حدد النوع والسياق</small></div>
        <i className="ph ph-arrow-left" aria-hidden="true" />
        <div><strong><span>3</span> نفّذ</strong><small>حوّلها لمهمة جاهزة</small></div>
      </div>

      <div className="knowledge-tabs" role="tablist" aria-label="طريقة عرض المفكرة">
        <button type="button" role="tab" id="knowledge-notes-tab" aria-selected={workspaceMode === 'notes'} aria-controls="knowledge-notes-panel" className={workspaceMode === 'notes' ? 'is-active' : ''} onClick={() => setWorkspaceMode('notes')}><i className="ph ph-notebook" /> المفكرة</button>
        <button type="button" role="tab" id="knowledge-board-tab" aria-selected={workspaceMode === 'board'} aria-controls="knowledge-board-panel" className={workspaceMode === 'board' ? 'is-active' : ''} onClick={() => setWorkspaceMode('board')}><i className="ph ph-kanban" /> لوحة التفكير</button>
      </div>

      {workspaceMode === 'board' ? (
        <section className="knowledge-board-view" role="tabpanel" id="knowledge-board-panel" aria-labelledby="knowledge-board-tab">
          <div className="knowledge-board-intro"><span className="page-hero-eyebrow">خط سير الفكرة</span><h2>أين وصلت الفكرة؟</h2><p>ابدأ من «أفكار جديدة»، رتّب ما يستحق التفكير، ثم حوّل الواضح إلى مهمة. لا تحتاج إلى استخدام الأعمدة كلها.</p></div>
              {loading ? <p className="knowledge-muted knowledge-board-loading">جارٍ تجهيز لوحة التفكير…</p> : <div className="knowledge-board-columns">
            {BOARD_STAGES.map((stage) => (
              <div className="knowledge-board-column" key={stage.id}><div className="knowledge-board-column-head"><span><i className={`ph ${stage.icon}`} />{stage.label}</span><small>{stage.hint}</small></div>
                {filtered.filter((note) => (note.board_stage || 'capture') === stage.id).map((note) => <div className="knowledge-board-note" key={note.id}><button type="button" className="knowledge-board-note-open" onClick={() => { hydratedId.current = null; setActiveId(note.id); setWorkspaceMode('notes'); }}><strong>{note.title || 'بدون عنوان'}</strong><span>{notePreview(note)}</span></button><div className="knowledge-board-note-actions"><button type="button" disabled={stage.id === 'capture'} onClick={() => moveBoardStage(note, -1)} title="العمود السابق"><i className="ph ph-arrow-right" /></button><button type="button" disabled={stage.id === 'next'} onClick={() => moveBoardStage(note, 1)} title="العمود التالي"><i className="ph ph-arrow-left" /></button></div></div>)}
                <button type="button" className="knowledge-board-add" onClick={() => createForType('note')}><i className="ph ph-plus" /> التقط فكرة</button>
              </div>
            ))}
              </div>}
            </section>
          ) : (
        <section className="knowledge-editor-shell" role="tabpanel" id="knowledge-notes-panel" aria-labelledby="knowledge-notes-tab">
          <aside className="knowledge-sidebar">
            <div className="knowledge-sidebar-top"><strong>مساحة المعرفة</strong><span>{filtered.length}</span></div>
            <div className="knowledge-search"><i className="ph ph-magnifying-glass" /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ابحث في الملاحظات والقوائم…" aria-label="بحث في المفكرة" /></div>
            <div className="knowledge-create-grid">
              {Object.entries(NOTE_TYPES).map(([type, meta]) => <button type="button" key={type} onClick={() => createForType(type)} title={`إنشاء ${meta.label}`}><i className={`ph ${meta.icon}`} /><span>{meta.label}</span></button>)}
            </div>
            <div className="knowledge-filter-list" aria-label="تصفية نوع المعرفة">
              {[['all', 'الكل', 'ph-squares-four'], ['pinned', 'مثبت', 'ph-push-pin'], ['checklist', 'قوائم', 'ph-list-checks'], ['decision', 'قرارات', 'ph-seal-check'], ['reference', 'مراجع', 'ph-bookmark-simple']].map(([id, label, icon]) => <button type="button" key={id} className={filter === id ? 'is-active' : ''} onClick={() => setFilter(id)}><i className={`ph ${icon}`} />{label}</button>)}
            </div>
            {labels.length > 0 && <div className="knowledge-labels-filter"><span>الوسوم</span><div>{labels.map((label) => <button type="button" key={label} onClick={() => setQuery(label)}>#{label}</button>)}</div></div>}
            <div className="knowledge-note-list">
              {loading && <p className="knowledge-muted">جاري تحميل المعرفة…</p>}
              {!loading && filtered.length === 0 && <p className="knowledge-muted">لا توجد عناصر بهذا السياق.</p>}
              {filtered.map((note) => <button type="button" key={note.id} className={`knowledge-note-item ${activeId === note.id ? 'is-active' : ''}`} onClick={() => { hydratedId.current = null; setActiveId(note.id); }}><span className="knowledge-note-item-icon"><i className={`ph ${NOTE_TYPES[note.note_type]?.icon || 'ph-note'}`} /></span><span><strong>{note.is_pinned && <i className="ph ph-push-pin-fill" />} {note.title || 'بدون عنوان'}</strong><small>{notePreview(note)}</small></span></button>)}
            </div>
          </aside>
          <article className="knowledge-editor">
            {!activeNote ? <div className="knowledge-empty"><i className="ph ph-notebook" /><h2>التقط ما تفكر فيه</h2><p>حوّل الأفكار المبعثرة إلى أفعال منظمة. ابدأ بكتابة أي شيء، ثم حدد لاحقاً إن كان قراراً أو مرجعاً أو قائمة مهام.</p><div className="knowledge-empty-actions"><button type="button" className="btn-primary" onClick={() => createForType('note')}><i className="ph ph-lightning" /> سجل فكرة سريعة</button><button type="button" className="btn-secondary" onClick={() => createForType('checklist')}><i className="ph ph-list-checks" /> أنشئ قائمة</button></div></div> : <>
              <div className="knowledge-editor-top"><span className="knowledge-status"><i className="ph ph-cloud-check" /> حفظ تلقائي</span><div className="knowledge-editor-actions"><button type="button" className={`knowledge-mode-button ${editorMode === 'edit' ? 'is-active' : ''}`} onClick={() => setEditorMode('edit')}>تحرير</button><button type="button" className={`knowledge-mode-button ${editorMode === 'preview' ? 'is-active' : ''}`} onClick={() => setEditorMode('preview')}>قراءة</button><button type="button" className={`knowledge-icon-action ${activeNote.is_pinned ? 'is-active' : ''}`} onClick={() => updateMeta({ is_pinned: !activeNote.is_pinned })} title="تثبيت"><i className="ph ph-push-pin" /></button><button type="button" className="knowledge-icon-action" onClick={() => downloadMd(draftTitle, draftContent)} title="تصدير Markdown"><i className="ph ph-download-simple" /></button><button type="button" className="knowledge-icon-action danger" onClick={handleDelete} title="حذف الصفحة"><i className="ph ph-trash" /></button></div></div>
              <div className="knowledge-type-row">{Object.entries(NOTE_TYPES).map(([type, meta]) => <button type="button" key={type} className={activeNote.note_type === type ? 'is-active' : ''} onClick={() => updateMeta({ note_type: type })}><i className={`ph ${meta.icon}`} />{meta.label}</button>)}</div>
              <div className="knowledge-editor-guide"><span className="knowledge-editor-guide-icon"><i className={`ph ${NOTE_TYPES[activeNote.note_type]?.icon || 'ph-note'}`} /></span><div><strong>{activeGuidance.title}</strong><p>{activeGuidance.hint}</p></div></div>
              <input className="knowledge-title-input" value={draftTitle} onChange={(event) => setDraftTitle(event.target.value)} placeholder="عنوان واضح للملاحظة" />
              <div className="knowledge-meta-row"><label><i className="ph ph-tag" /><input value={draftLabels.join(', ')} onChange={(event) => saveLabels(event.target.value)} placeholder="وسوم: عمل، فكرة، بحث" /></label><label><i className="ph ph-kanban" /><select aria-label="حالة بطاقة لوحة التفكير" value={activeNote.board_stage || 'capture'} onChange={(event) => updateMeta({ board_stage: event.target.value })}>{BOARD_STAGES.map((stage) => <option value={stage.id} key={stage.id}>{stage.label}</option>)}</select></label></div>
              <div className="knowledge-divider" />
              {activeNote.note_type === 'checklist' ? <div className="knowledge-checklist-editor"><div className="knowledge-checklist-head"><span>عناصر القائمة</span><small>{draftChecklist.filter((item) => item.completed).length}/{draftChecklist.length} منجزة</small></div>{draftChecklist.map((item) => <div className="knowledge-checklist-item" key={item.id}><button type="button" onClick={() => toggleChecklistItem(item.id)}><i className={`ph ${item.completed ? 'ph-check-square' : 'ph-square'}`} /></button><input value={item.title} onChange={(event) => setDraftChecklist((items) => items.map((entry) => entry.id === item.id ? { ...entry, title: event.target.value } : entry))} placeholder="عنصر في القائمة" /><button type="button" className="knowledge-list-remove" onClick={() => setDraftChecklist((items) => items.filter((entry) => entry.id !== item.id))}><i className="ph ph-x" /></button></div>)}<div className="knowledge-checklist-add"><input value={newChecklistItem} onChange={(event) => setNewChecklistItem(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addChecklistItem(); } }} placeholder="أضف عنصرًا ثم Enter" /><button type="button" onClick={addChecklistItem}><i className="ph ph-plus" /> إضافة</button></div></div> : editorMode === 'edit' ? <textarea className="knowledge-content-input" value={draftContent} onChange={(event) => setDraftContent(event.target.value)} placeholder={activeGuidance.placeholder} /> : <div className="knowledge-rendered-content" dangerouslySetInnerHTML={{ __html: marked.parse(draftContent || '*لا يوجد محتوى بعد*') }} />}
              <div className="knowledge-command-bar"><span>خطوة تالية</span><button type="button" onClick={() => setDraftContent((content) => `${content}${content ? '\n\n' : ''}## القرار\n\n`)}>أضف قرارًا</button><button type="button" onClick={() => setDraftContent((content) => `${content}${content ? '\n\n' : ''}### مراجع\n\n`)}>أضف مرجعًا</button><button type="button" onClick={convertToTask}><i className="ph ph-check-square" /> حوّلها إلى مهمة</button></div>
            </>}
          </article>
        </section>
      )}
    </div>
  );
}
