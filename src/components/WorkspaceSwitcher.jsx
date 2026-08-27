import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ALL_WORKSPACES_ID,
  TRELLO_WORKSPACE_ID,
  WORKSPACE_BACKGROUNDS,
  WORKSPACE_COLORS,
  WORKSPACE_ICONS,
  getWorkspaceBackground,
  isSystemWorkspace,
} from '../utils/taskMeta';

/** أرشفة المساحة متاحة للمساحات التي أنشأها المستخدم فقط — ليس مشاريعي/شخصي/علامة */
function isProtectedFromArchive(ws) {
  return isSystemWorkspace(ws);
}

const GRADIENTS = WORKSPACE_BACKGROUNDS.filter((b) => b.kind === 'gradient' || b.kind === 'none');
const SOLIDS = WORKSPACE_BACKGROUNDS.filter((b) => b.kind === 'solid');

function SurfacePick({ item, active, onSelect }) {
  const isNone = item.kind === 'none';
  const isLight = isNone || item.id === 'frost';
  return (
    <button
      type="button"
      className={`workspace-surface-pick ${active ? 'active' : ''} ${isLight ? 'is-light' : ''}`}
      title={item.name}
      onClick={() => onSelect(item.id)}
    >
      <span
        className="workspace-surface-pick-swatch"
        style={
          isNone
            ? { background: 'var(--bg-color)', border: '1px dashed var(--border-color)' }
            : { background: item.css }
        }
      />
      <span className="workspace-surface-pick-label">
        {item.emoji ? `${item.emoji} ` : ''}{item.name}
      </span>
      {active && (
        <span className="workspace-surface-pick-check" aria-hidden="true">
          <i className="ph ph-check" />
        </span>
      )}
    </button>
  );
}

export default function WorkspaceSwitcher({
  workspaces = [],
  activeWorkspaceId,
  onSwitch,
  onCreate,
  onUpdate,
  onArchiveSpace,
  onRestoreSpace,
  onReorder,
  isAllMode,
}) {
  const [dragId, setDragId] = useState(null);
  const [overId, setOverId] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editId, setEditId] = useState(null);
  const [menuId, setMenuId] = useState(null);
  const [name, setName] = useState('');
  const [trait, setTrait] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState(WORKSPACE_ICONS[2]);
  const [colorIndex, setColorIndex] = useState(2);
  const [surface, setSurface] = useState('none');
  const menuRef = useRef(null);

  const visible = useMemo(() => workspaces.filter((w) => !w.archived), [workspaces]);
  const archived = useMemo(() => workspaces.filter((w) => w.archived), [workspaces]);

  const editing = useMemo(
    () => workspaces.find((w) => w.id === editId) || null,
    [workspaces, editId]
  );

  useEffect(() => {
    if (!menuId) return undefined;
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuId(null);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [menuId]);

  const openEdit = (ws) => {
    setMenuId(null);
    setEditId(ws.id);
    setName(ws.label);
    setTrait(ws.trait || '');
    setDescription(ws.description || '');
    setIcon(ws.icon || WORKSPACE_ICONS[0]);
    const idx = WORKSPACE_COLORS.findIndex(
      (c) => c.color === ws.color || c.bg === ws.bg
    );
    setColorIndex(idx >= 0 ? idx : 0);
    setSurface(getWorkspaceBackground(ws.surface).id);
  };

  const openCreate = () => {
    setName('');
    setTrait('');
    setDescription('');
    setIcon(WORKSPACE_ICONS[2]);
    setColorIndex(2);
    setSurface('none');
    setShowCreate(true);
  };

  const submitCreate = (e) => {
    e?.preventDefault?.();
    const created = onCreate?.({ name, icon, colorIndex, trait, description, surface });
    if (created) {
      setName('');
      setTrait('');
      setDescription('');
      setShowCreate(false);
    }
  };

  const submitEdit = (e) => {
    e?.preventDefault?.();
    if (!editId || !name.trim()) return;
    onUpdate?.(editId, {
      label: name.trim(),
      icon,
      colorIndex,
      trait: trait.trim(),
      description: description.trim(),
      surface,
    });
    setEditId(null);
  };

  const handleArchive = () => {
    if (!editing || isProtectedFromArchive(editing)) return;
    const ok = window.confirm(
      `أرشفة مساحة «${editing.label}»؟\n\nستُخفى من الشريط وتُؤرشف مهامها النشطة.\nلا يُحذف شيء من قاعدة البيانات.`
    );
    if (!ok) return;
    onArchiveSpace?.(editing.id);
    setEditId(null);
  };

  const palette = WORKSPACE_COLORS[colorIndex % WORKSPACE_COLORS.length];
  const activeWs = !isAllMode
    ? workspaces.find((w) => w.id === activeWorkspaceId)
    : null;

  return (
    <div className="workspace-switcher">
      <div className="workspace-tabs" role="tablist" aria-label="المساحات">
        <button
          type="button"
          role="tab"
          aria-selected={isAllMode}
          className={`workspace-tab workspace-all-tab ${isAllMode ? 'active' : ''}`}
          onClick={() => onSwitch(ALL_WORKSPACES_ID)}
          title="كل المساحات — عرض وتقارير شاملة"
        >
          <i className="ph ph-squares-four"></i>
          <span>الكل</span>
        </button>

        {visible.map((ws) => {
          const active = !isAllMode && ws.id === activeWorkspaceId;
          const isTrello = ws.id === TRELLO_WORKSPACE_ID;
          return (
            <div
              key={ws.id}
              className={`workspace-tab-wrap ${dragId === ws.id ? 'dragging' : ''} ${
                overId === ws.id ? 'drag-over' : ''
              }`}
              ref={menuId === ws.id ? menuRef : null}
              draggable
              onDragStart={(e) => {
                setDragId(ws.id);
                e.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => {
                setDragId(null);
                setOverId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragId && dragId !== ws.id) setOverId(ws.id);
              }}
              onDragLeave={() => setOverId((id) => (id === ws.id ? null : id))}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId && dragId !== ws.id) onReorder?.(dragId, ws.id);
                setDragId(null);
                setOverId(null);
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={active}
                className={`workspace-tab ${active ? 'active' : ''}`}
                style={{ '--ws-color': ws.color, '--ws-bg': ws.bg }}
                onClick={() => onSwitch(ws.id)}
                onDoubleClick={() => openEdit(ws)}
                title={
                  isTrello
                    ? `${ws.label} — مُدارة تلقائياً عبر تريلو`
                    : ws.trait
                      ? `${ws.label} — ${ws.trait}`
                      : ws.label
                }
              >
                <i className={`ph ${ws.icon}`}></i>
                <span className="workspace-tab-label">{ws.label}</span>
                {isTrello && (
                  <span className="workspace-trello-badge" title="مُدارة تلقائياً عبر تريلو">
                    تريلو
                  </span>
                )}
                <span
                  className="workspace-tab-more"
                  role="button"
                  tabIndex={0}
                  title="خيارات المساحة"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuId((id) => (id === ws.id ? null : ws.id));
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      setMenuId((id) => (id === ws.id ? null : ws.id));
                    }
                  }}
                >
                  <i className="ph ph-dots-three"></i>
                </span>
              </button>

              {menuId === ws.id && (
                <div className="workspace-menu">
                  <button type="button" onClick={() => openEdit(ws)}>
                    <i className="ph ph-pencil-simple"></i>
                    تعديل المظهر
                  </button>
                  {!isProtectedFromArchive(ws) && (
                    <button
                      type="button"
                      className="workspace-menu-danger"
                      onClick={() => {
                        setMenuId(null);
                        const ok = window.confirm(
                          `أرشفة مساحة «${ws.label}»؟\n\nستُخفى من الشريط وتُؤرشف مهامها النشطة.`
                        );
                        if (ok) onArchiveSpace?.(ws.id);
                      }}
                    >
                      <i className="ph ph-archive"></i>
                      أرشفة المساحة
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}

        <button
          type="button"
          className="workspace-tab workspace-add-tab"
          onClick={openCreate}
          title="مساحة جديدة"
        >
          <i className="ph ph-plus"></i>
          <span>جديد</span>
        </button>
      </div>

      {activeWs?.id === TRELLO_WORKSPACE_ID && !isAllMode && (
        <p className="workspace-trait-line" style={{ color: activeWs.color }}>
          <i className="ph ph-kanban"></i>
          مُدارة تلقائياً عبر تريلو — المزامنة من الإعدادات
        </p>
      )}

      {activeWs?.trait && activeWs?.id !== TRELLO_WORKSPACE_ID && !isAllMode && (
        <p className="workspace-trait-line" style={{ color: activeWs.color }}>
          <i className={`ph ${activeWs.icon}`}></i>
          {activeWs.trait}
        </p>
      )}

      {activeWs?.description && !isAllMode && (
        <p className="workspace-description-line">{activeWs.description}</p>
      )}

      {isAllMode && (
        <p className="workspace-all-hint">
          عرض شامل لكل المهام النشطة — التقارير للمنصة كاملة. الإضافة تُسجَّل في أول مساحة نشطة.
        </p>
      )}

      {archived.length > 0 && (
        <div className="workspace-archived-bar">
          <span className="workspace-archived-label">
            <i className="ph ph-archive"></i>
            مؤرشفة ({archived.length})
          </span>
          <div className="workspace-archived-list">
            {archived.map((ws) => (
              <button
                key={ws.id}
                type="button"
                className="workspace-archived-chip"
                style={{ '--ws-color': ws.color }}
                title={`استرجاع «${ws.label}»`}
                onClick={() => onRestoreSpace?.(ws.id)}
              >
                <i className={`ph ${ws.icon}`}></i>
                {ws.label}
                <i className="ph ph-arrow-counter-clockwise"></i>
              </button>
            ))}
          </div>
        </div>
      )}

      {(showCreate || editing) && (
        <div
          className="modal-overlay open workspace-create-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreate(false);
              setEditId(null);
            }
          }}
        >
          <div className="modal-box card workspace-create-modal">
            <div className="modal-header">
              <h3>{editing ? 'تعديل مظهر المساحة' : 'مساحة جديدة'}</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => {
                  setShowCreate(false);
                  setEditId(null);
                }}
              >
                <i className="ph ph-x" style={{ fontSize: 20 }}></i>
              </button>
            </div>

            <div
              className="workspace-preview-chip"
              style={{ '--ws-color': palette.color, '--ws-bg': palette.bg }}
            >
              <i className={`ph ${icon}`}></i>
              <span>{name.trim() || 'اسم المساحة'}</span>
            </div>

            <form onSubmit={editing ? submitEdit : submitCreate}>
              <div className="form-field">
                <label>اسم المساحة</label>
                <input
                  type="text"
                  className="form-input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: دراسة، مشروع عميل…"
                  autoFocus
                  required
                />
              </div>
              <div className="form-field">
                <label>السمة / شعار قصير</label>
                <input
                  type="text"
                  className="form-input"
                  value={trait}
                  onChange={(e) => setTrait(e.target.value)}
                  placeholder="مثال: تركيز عميق · عملاء · عائلة"
                  maxLength={80}
                />
              </div>
              <div className="form-field">
                <label>وصف (اختياري)</label>
                <textarea
                  className="form-input"
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="سطر يوضح غرض المساحة لك"
                  maxLength={200}
                />
              </div>
              <div className="form-field">
                <label>الأيقونة</label>
                <div className="workspace-icon-picks">
                  {WORKSPACE_ICONS.map((ic) => (
                    <button
                      key={ic}
                      type="button"
                      className={`workspace-icon-pick ${icon === ic ? 'active' : ''}`}
                      onClick={() => setIcon(ic)}
                      title={ic}
                    >
                      <i className={`ph ${ic}`}></i>
                    </button>
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>لون التمييز</label>
                <div className="workspace-color-picks">
                  {WORKSPACE_COLORS.map((c, i) => (
                    <button
                      key={i}
                      type="button"
                      className={`workspace-color-pick ${colorIndex === i ? 'active' : ''}`}
                      style={{ background: c.color }}
                      title={c.name || ''}
                      onClick={() => setColorIndex(i)}
                    />
                  ))}
                </div>
              </div>
              <div className="form-field">
                <label>خلفية المساحة</label>
                <p className="workspace-surface-section-label">تدرجات</p>
                <div className="workspace-surface-picks">
                  {GRADIENTS.map((item) => (
                    <SurfacePick
                      key={item.id}
                      item={item}
                      active={surface === item.id}
                      onSelect={setSurface}
                    />
                  ))}
                </div>
                <p className="workspace-surface-section-label">ألوان صلبة</p>
                <div className="workspace-surface-picks">
                  {SOLIDS.map((item) => (
                    <SurfacePick
                      key={item.id}
                      item={item}
                      active={surface === item.id}
                      onSelect={setSurface}
                    />
                  ))}
                </div>
              </div>
              <div className="modal-footer" style={{ flexWrap: 'wrap' }}>
                <button type="submit" className="btn-primary" style={{ flex: 1 }} disabled={!name.trim()}>
                  {editing ? 'حفظ المظهر' : 'إنشاء المساحة'}
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => {
                    setShowCreate(false);
                    setEditId(null);
                  }}
                >
                  إلغاء
                </button>
                {editing && !isProtectedFromArchive(editing) && (
                  <button
                    type="button"
                    className="btn-secondary workspace-archive-btn"
                    onClick={handleArchive}
                  >
                    <i className="ph ph-archive"></i>
                    أرشفة المساحة
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
