import { useMemo, useState } from 'react';
import { ALL_WORKSPACES_ID } from '../utils/taskMeta';

const VIEW_META = {
  Today: { label: 'مساحة العمل', icon: 'ph-sun-dim' },
  Projects: { label: 'المشاريع', icon: 'ph-folder-notch' },
  Kpi: { label: 'التقدم', icon: 'ph-chart-line-up' },
  Motivation: { label: 'استراحة', icon: 'ph-coffee' },
  Notepad: { label: 'المفكرة', icon: 'ph-notebook' },
  Archive: { label: 'سجل الإنجاز', icon: 'ph-archive' },
  Settings: { label: 'الإعدادات', icon: 'ph-gear-six' },
};

export default function AppFrame({
  view = 'Today',
  workspaces = [],
  activeWorkspaceId,
  isAllMode,
  onSwitchWorkspace,
  onSwitchView,
  contextExtra = null,
  showWorkspaceContext = false,
  children,
}) {
  const [workspaceMenuOpen, setWorkspaceMenuOpen] = useState(false);
  const current = VIEW_META[view] || VIEW_META.Today;
  const activeWorkspace = useMemo(() => workspaces.find((space) => space.id === activeWorkspaceId), [workspaces, activeWorkspaceId]);
  const workspaceLabel = isAllMode ? 'كل المساحات' : activeWorkspace?.label || 'مساحة العمل';
  const compactActions = [
    ['Today', 'ph-sun-dim', 'مساحة العمل'],
    ['Projects', 'ph-folder-notch', 'المشاريع'],
    ['Kpi', 'ph-chart-line-up', 'التقدم'],
    ['Notepad', 'ph-notebook', 'المفكرة'],
    ['Settings', 'ph-gear-six', 'الإعدادات'],
  ];
  const selectWorkspace = (id) => {
    onSwitchWorkspace(id);
    setWorkspaceMenuOpen(false);
  };

  return (
    <div className="radical-shell">
      <header className="radical-topbar">
        <button type="button" className="radical-brand" onClick={() => onSwitchView('Today')}>
          <img src="/logo.svg" alt="مهد" />
          <span>مهد</span>
        </button>
        <div className="app-frame-location" aria-label="الموقع الحالي">
          <i className={`ph ${current.icon}`} />
          <strong>{current.label}</strong>
        </div>
        <div className="app-frame-actions" aria-label="اختصارات التنقل">
          {showWorkspaceContext && <div className="workspace-menu">
            <button type="button" className={`workspace-menu-trigger ${workspaceMenuOpen ? 'is-open' : ''}`} onClick={() => setWorkspaceMenuOpen((open) => !open)} aria-expanded={workspaceMenuOpen}>
              <i className="ph ph-buildings" /><span>{workspaceLabel}</span><i className="ph ph-caret-down" />
            </button>
            {workspaceMenuOpen && <div className="workspace-menu-popover" role="menu" aria-label="اختيار مساحة العمل">
              <div className="workspace-menu-head"><span>مساحات العمل</span><small>اختر الحاوية التي تعمل داخلها</small></div>
              <button type="button" role="menuitemradio" aria-checked={isAllMode} className={isAllMode ? 'is-active' : ''} onClick={() => selectWorkspace(ALL_WORKSPACES_ID)}><i className="ph ph-squares-four" /><span>كل المساحات</span>{isAllMode && <i className="ph ph-check" />}</button>
              {workspaces.filter((space) => space.archived !== true).map((space) => <button type="button" role="menuitemradio" aria-checked={!isAllMode && activeWorkspaceId === space.id} key={space.id} className={!isAllMode && activeWorkspaceId === space.id ? 'is-active' : ''} onClick={() => selectWorkspace(space.id)}>{space.icon && <i className={`ph ${space.icon}`} />}<span>{space.label}</span>{!isAllMode && activeWorkspaceId === space.id && <i className="ph ph-check" />}</button>)}
            </div>}
          </div>}
          <div className="app-frame-nav-icons">
            {compactActions.map(([id, icon, label]) => (
              <button type="button" key={id} className={view === id ? 'is-active' : ''} onClick={() => onSwitchView(id)} title={label} aria-label={label}>
                <i className={`ph ${icon}`} />
              </button>
            ))}
          </div>
        </div>
      </header>

      {contextExtra && <section className="radical-operation-context" aria-label="اختيار المشروع">{contextExtra}</section>}
      {children}
    </div>
  );
}
