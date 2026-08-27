import { useEffect, useMemo, useRef, useState } from 'react';
import Sidebar from './components/Sidebar';
import FloatingSmartBar from './components/QuickAdd';
import QuadrantBoard from './components/QuadrantBoard';
import TimelineView from './components/TimelineView';
import GanttView from './components/GanttView';
import PlannerView from './components/PlannerView';
import PendingView from './components/PendingView';
import TodayView from './components/TodayView';
import ProjectsView from './components/ProjectsView';
import KpiView from './components/KpiView';
import BreakSpace from './components/BreakSpace';
import FloatingTimer from './components/FloatingTimer';
import TimeTrackingSync from './components/TimeTrackingSync';
import SettingsView from './components/SettingsView';
import ArchiveView from './components/ArchiveView';
import NotepadView from './components/NotepadView';
import TaskModal from './components/TaskModal';
import ProjectModal from './components/ProjectModal';
import NotesModal from './components/NotesModal';
import ShortcutsHelp from './components/ShortcutsHelp';
import TaskSearch from './components/TaskSearch';
import LoadingSkeleton from './components/LoadingSkeleton';
import ViewSwitcher from './components/ViewSwitcher';
import WorkspaceSwitcher from './components/WorkspaceSwitcher';
import PageHeader from './components/PageHeader';
import WorkSurface from './components/WorkSurface';
import AppFrame from './components/AppFrame';
import { useTasks } from './hooks/useTasks';
import { sendNotificationPreview, useLocalNotifications } from './hooks/useLocalNotifications';
import { useTrello } from './hooks/useTrello';
import { useToast } from './hooks/useToast';
import { useWorkDaysSetting } from './hooks/useWorkDaysSetting';
import { usePushNotifications } from './hooks/usePushNotifications';
import { useWorkspaces } from './hooks/useWorkspaces';
import { useProjects } from './hooks/useProjects';
import { exportTasksAsCsv, exportTasksAsXlsx, readImportFile } from './utils/importExport';
import {
  ALL_WORKSPACES_ID,
  DEFAULT_WORK_DAYS,
  getWorkspaceBackground,
  isSystemWorkspace,
  normalizeTaskContext,
  normalizeWorkDays,
} from './utils/taskMeta';
import { isEffectivelyOpen, normalizeTaskStatus } from './utils/taskStatus';

const THEME_KEY = 'mahd_theme_react_v1';
const NOTIFICATION_SETTINGS_KEY = 'mahd_notification_settings_v1';

const NAV_BY_DIGIT = {
  '1': 'Matrix',
  '2': 'Pending',
  '3': 'Kpi',
  '4': 'Motivation',
  '5': 'Notepad',
  '6': 'Archive',
  '7': 'Settings',
};

const DEFAULT_NOTIFICATION_SETTINGS = {
  enabled: false,
  morningSummary: true,
  morningTime: '10:00',
  eveningReview: true,
  eveningTime: '20:00',
  activeDays: DEFAULT_WORK_DAYS,
};

function normalizeNotificationSettings(value) {
  return {
    ...DEFAULT_NOTIFICATION_SETTINGS,
    ...(value || {}),
    activeDays: normalizeWorkDays(value?.activeDays || DEFAULT_NOTIFICATION_SETTINGS.activeDays),
  };
}

function readSavedNotificationSettings() {
  try {
    const raw = localStorage.getItem(NOTIFICATION_SETTINGS_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_SETTINGS;
    return normalizeNotificationSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_NOTIFICATION_SETTINGS;
  }
}

function getNotificationPermission() {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported';
  return Notification.permission;
}

function isTypingTarget(el) {
  if (!el || !(el instanceof Element)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return Boolean(el.closest?.('[contenteditable="true"]'));
}

const TRELLO_SYNC_ENABLED = true;

export default function App() {
  const showToast = useToast();
  const {
    tasks,
    loading,
    connected,
    addTask,
    updateTask,
    archiveTask,
    archiveTasksInContext,
    restoreTask,
    toggleComplete,
    setTaskStatus,
    toggleSubtask,
    moveTask,
    rescheduleTask,
    reorderInQuadrant,
    replaceTasksInContext,
    refetch,
  } = useTasks(showToast);

  const trello = useTrello(showToast, () => refetch());
  const {
    workspaces,
    visibleWorkspaces,
    activeWorkspaceId,
    activeWorkspace,
    isAllMode,
    writeContextId,
    setActiveWorkspaceId,
    addWorkspace,
    updateWorkspace,
    archiveWorkspace,
    restoreWorkspace,
    reorderWorkspaces,
    ensureContextsFromTasks,
  } = useWorkspaces();
  const { projects, addProject } = useProjects(showToast);

  const [view, setView] = useState('Today');
  const [subview, setSubview] = useState('Board');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [theme, setTheme] = useState(() => localStorage.getItem(THEME_KEY) || 'light');
  const { workDays, setWorkDays } = useWorkDaysSetting(showToast);
  const [notificationSettings, setNotificationSettings] = useState(readSavedNotificationSettings);
  const [notificationPermission, setNotificationPermission] = useState(getNotificationPermission);
  const [modalOpen, setModalOpen] = useState(false);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [notesTarget, setNotesTarget] = useState(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const trelloAutoSynced = useRef(false);

  const openAddModal = () => {
    setEditingTaskId(null);
    setModalOpen(true);
  };
  const openEditModal = (id) => {
    setEditingTaskId(id);
    setModalOpen(true);
  };
  const closeModal = () => setModalOpen(false);
  const openProjectModal = () => setProjectModalOpen(true);
  const closeProjectModal = () => setProjectModalOpen(false);
  const handleSaveProject = async (form) => {
    const created = await addProject(form);
    if (created) closeProjectModal();
  };

  useEffect(() => {
    if (!tasks.length) return;
    ensureContextsFromTasks(tasks.map((t) => t.context));
  }, [tasks, ensureContextsFromTasks]);

  useEffect(() => {
    const handler = (e) => setNotesTarget(e.detail);
    window.addEventListener('open-task-notes', handler);
    return () => window.removeEventListener('open-task-notes', handler);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') {
        if (searchOpen) {
          e.preventDefault();
          setSearchOpen(false);
          return;
        }
        if (shortcutsOpen) {
          e.preventDefault();
          setShortcutsOpen(false);
          return;
        }
        if (notesTarget) {
          e.preventDefault();
          setNotesTarget(null);
          return;
        }
        if (modalOpen) {
          e.preventDefault();
          setModalOpen(false);
          return;
        }
        if (sidebarOpen) {
          e.preventDefault();
          setSidebarOpen(false);
        }
        return;
      }

      if (!e.altKey && !e.ctrlKey && !e.metaKey && (e.key === '?' || e.key === '/')) {
        if (isTypingTarget(e.target)) return;
        e.preventDefault();
        setShortcutsOpen((v) => !v);
        return;
      }

      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      if (isTypingTarget(e.target) && e.key !== 'Escape') return;

      const k = e.key;

      if (k === 'g' || k === 'G' || k === '4') {
        e.preventDefault();
        setView('Motivation');
        setSidebarOpen(false);
        return;
      }

      if (k === 'n' || k === 'N') {
        e.preventDefault();
        openAddModal();
        return;
      }

      if (k === 'f' || k === 'F') {
        e.preventDefault();
        setSearchOpen(true);
        return;
      }

      if (NAV_BY_DIGIT[k]) {
        e.preventDefault();
        setView(NAV_BY_DIGIT[k]);
        setSidebarOpen(false);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [searchOpen, shortcutsOpen, notesTarget, modalOpen, sidebarOpen]);

  useEffect(() => {
    if (view === 'Trello') setView('Settings');
  }, [view]);

  const spaceTasks = useMemo(() => {
    if (isAllMode) return tasks;
    return tasks.filter((t) => normalizeTaskContext(t.context) === activeWorkspaceId);
  }, [tasks, activeWorkspaceId, isAllMode]);

  const visibleTasks = useMemo(
    () => spaceTasks.filter((t) => !t.archived),
    [spaceTasks]
  );

  const boardTasks = useMemo(
    () => visibleTasks.filter((t) => normalizeTaskStatus(t) !== 'deferred'),
    [visibleTasks]
  );

  const searchableTasks = useMemo(
    () => tasks.filter((t) => !t.archived),
    [tasks]
  );

  const trelloPageTasks = useMemo(
    () => tasks.filter((t) => !t.archived && t.externalSource === 'trello'),
    [tasks]
  );

  const archivedTasks = useMemo(
    () => spaceTasks.filter((t) => t.archived),
    [spaceTasks]
  );

  const workspaceSurface = useMemo(
    () => getWorkspaceBackground(isAllMode ? 'none' : activeWorkspace?.surface),
    [isAllMode, activeWorkspace?.surface]
  );

  const mainSurfaceStyle =
    workspaceSurface.id !== 'none' && workspaceSurface.css
      ? { '--ws-surface': workspaceSurface.css }
      : undefined;

  useEffect(() => {
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(
      NOTIFICATION_SETTINGS_KEY,
      JSON.stringify(normalizeNotificationSettings(notificationSettings))
    );
  }, [notificationSettings]);

  useLocalNotifications(boardTasks, workDays, notificationSettings);
  const push = usePushNotifications(showToast);

  useEffect(() => {
    if (!TRELLO_SYNC_ENABLED) return;
    if (!trello.isConnected || trello.loading) return;
    if (trelloAutoSynced.current) return;
    trelloAutoSynced.current = true;
    trello.syncNow({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trello.isConnected, trello.loading]);

  const editingTask = useMemo(
    () => tasks.find((t) => t.id === editingTaskId) || null,
    [tasks, editingTaskId]
  );

  const pendingCount = visibleTasks.filter((t) => {
    const s = normalizeTaskStatus(t);
    if (s === 'cancelled' || s === 'deferred') return false;
    return isEffectivelyOpen(t);
  }).length;
  const trelloCount = trelloPageTasks.filter((t) => !t.completed).length;
  const archiveCount = archivedTasks.length;

  const trelloForUi = {
    ...trello,
    syncNow: TRELLO_SYNC_ENABLED
      ? trello.syncNow
      : async () => {
          showToast('مزامنة تريلو متوقفة مؤقتاً', 'ph-pause');
          return { created: 0, updated: 0 };
        },
  };

  const handleSaveTask = (form, id) => {
    const extra = {
      recurrence: form.recurrence || null,
      recurrenceDays: form.recurrenceDays || [],
      context: form.context || writeContextId,
      projectId: form.projectId || null,
      deliverable: form.deliverable || '',
      deliverableUrl: form.deliverableUrl || '',
      subtasks: form.subtasks || [],
      status: form.status || 'not_started',
    };
    if (id) {
      updateTask(id, form.title, form.quadrant, form.dueDate, form.notes, form.duration, extra);
    } else {
      addTask(form.title, form.quadrant, form.dueDate, form.notes, form.duration, extra);
    }
    closeModal();
  };

  const handleCreateWorkspace = ({ name, icon, colorIndex, trait, description, surface }) => {
    const created = addWorkspace({ name, icon, colorIndex, trait, description, surface });
    if (created) {
      showToast(`أُنشئت مساحة "${created.label}"`, 'ph-folder-plus');
    }
    return created;
  };

  const handleUpdateWorkspace = (id, patch) => {
    updateWorkspace(id, patch);
    showToast('تم تحديث المساحة', 'ph-pencil-simple');
  };

  const handleArchiveSpace = async (id) => {
    const target = workspaces.find((w) => w.id === id);
    if (isSystemWorkspace(target || id)) {
      showToast(
        'لا يمكن أرشفة المساحات الأساسية (مشاريعي / شخصي / علامة)',
        'ph-lock',
        'error'
      );
      return;
    }
    const okTasks = await archiveTasksInContext(id);
    if (!okTasks) return;
    const okSpace = archiveWorkspace(id);
    if (okSpace) {
      showToast('أُرشفت المساحة ومهامها النشطة', 'ph-archive');
    } else {
      showToast('تعذّرت أرشفة المساحة', 'ph-warning', 'error');
    }
  };

  const handleRestoreSpace = (id) => {
    restoreWorkspace(id);
    const ws = workspaces.find((w) => w.id === id);
    showToast(
      ws ? `استُرجعت مساحة «${ws.label}»` : 'استُرجعت المساحة',
      'ph-arrow-counter-clockwise'
    );
  };

  const requestNotificationPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported');
      showToast('المتصفح لا يدعم إشعارات سطح المكتب', 'ph-warning', 'error');
      return 'unsupported';
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    if (permission === 'granted') {
      showToast('تم تفعيل إذن التنبيهات', 'ph-bell-ringing');
      setNotificationSettings((prev) => ({ ...prev, enabled: true }));
    } else {
      showToast('لم يتم منح إذن التنبيهات', 'ph-warning', 'error');
    }
    return permission;
  };

  const sendTestNotification = () => {
    const ok = sendNotificationPreview();
    if (!ok) showToast('فعّل إذن التنبيهات أولاً', 'ph-warning', 'error');
  };

  const handleExport = (format) => {
    if (format === 'csv') exportTasksAsCsv(visibleTasks);
    else exportTasksAsXlsx(visibleTasks);
  };

  const handleImportFile = async (file) => {
    if (isAllMode || activeWorkspaceId === ALL_WORKSPACES_ID) {
      showToast('اختر مساحة محددة للاستيراد', 'ph-warning', 'error');
      return;
    }
    try {
      const imported = await readImportFile(file);
      if (imported.length === 0) {
        showToast('الملف فارغ أو غير صالح', 'ph-warning', 'error');
        return;
      }
      const spaceLabel = activeWorkspace?.label || activeWorkspaceId;
      const currentCount = visibleTasks.length;
      const confirmed = window.confirm(
        `سيتم أرشفة مهام مساحة «${spaceLabel}» النشطة (${currentCount}) وإضافة ${imported.length} مهمة جديدة.\n\nلا يُحذف شيء من قاعدة البيانات.\n\nهل أنت متأكد؟`
      );
      if (!confirmed) return;
      await replaceTasksInContext(activeWorkspaceId, imported);
    } catch (err) {
      console.error(err);
      showToast('حدث خطأ أثناء قراءة الملف', 'ph-x-circle', 'error');
    }
  };

  if (loading) {
    return (
      <div className="full-center" style={{ padding: 24 }}>
        <LoadingSkeleton />
        <p style={{ color: 'var(--text-secondary)', marginTop: 12, textAlign: 'center' }}>
          جاري تحميل المهام…
        </p>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="full-center" style={{ padding: 24 }}>
        <div className="card" style={{ maxWidth: 440, textAlign: 'center', padding: 36 }}>
          <h2 style={{ marginBottom: 12 }}>غير متصل بقاعدة البيانات</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
            تأكد من ملف .env ثم أعد تشغيل npm run dev
          </p>
          <button type="button" className="btn-primary" onClick={() => refetch()} style={{ margin: '0 auto' }}>
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  if (view === 'Today') {
    return (
      <div className="app-container radical-app-container">
        <WorkSurface
          tasks={visibleTasks}
          projects={projects}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          isAllMode={isAllMode}
          onSwitchWorkspace={setActiveWorkspaceId}
          onSwitchView={setView}
          onAddTask={openAddModal}
          onEditTask={openEditModal}
          onSetStatus={setTaskStatus}
          onToggleSubtask={toggleSubtask}
          workDays={workDays}
        />

        <TaskModal
          isOpen={modalOpen}
          task={editingTask}
          onClose={closeModal}
          onSave={handleSaveTask}
          workDays={workDays}
          defaultContext={writeContextId}
          workspaces={visibleWorkspaces}
          projects={projects}
        />
        <FloatingTimer />
        <TimeTrackingSync />
        <NotesModal
          isOpen={Boolean(notesTarget)}
          taskId={notesTarget?.taskId}
          taskTitle={notesTarget?.title}
          onClose={() => setNotesTarget(null)}
          showToast={showToast}
        />
        <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <TaskSearch
          isOpen={searchOpen}
          onClose={() => setSearchOpen(false)}
          tasks={searchableTasks}
          workspaces={workspaces}
          onSelectTask={openEditModal}
        />
      </div>
    );
  }

  if (view === 'Matrix' || view === 'Pending') {
    return (
      <div className="app-container radical-app-container">
        <WorkSurface
          key={view}
          defaultMode={view === 'Matrix' ? 'all' : 'inbox'}
          tasks={visibleTasks}
          projects={projects}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          isAllMode={isAllMode}
          onSwitchWorkspace={setActiveWorkspaceId}
          onSwitchView={setView}
          onAddTask={openAddModal}
          onEditTask={openEditModal}
          onSetStatus={setTaskStatus}
          onToggleSubtask={toggleSubtask}
          workDays={workDays}
        />
        <TaskModal isOpen={modalOpen} task={editingTask} onClose={closeModal} onSave={handleSaveTask} workDays={workDays} defaultContext={writeContextId} workspaces={visibleWorkspaces} projects={projects} />
        <ProjectModal isOpen={projectModalOpen} onClose={closeProjectModal} onSave={handleSaveProject} defaultContext={writeContextId} workspaces={visibleWorkspaces} />
        <FloatingTimer />
        <TimeTrackingSync />
        <NotesModal isOpen={Boolean(notesTarget)} taskId={notesTarget?.taskId} taskTitle={notesTarget?.title} onClose={() => setNotesTarget(null)} showToast={showToast} />
        <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <TaskSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} tasks={searchableTasks} workspaces={workspaces} onSelectTask={openEditModal} />
      </div>
    );
  }

  if (['Projects', 'Kpi', 'Motivation', 'Notepad', 'Archive', 'Settings'].includes(view)) {
    return (
      <div className="app-container radical-app-container">
        <AppFrame
          view={view}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          isAllMode={isAllMode}
          onSwitchWorkspace={setActiveWorkspaceId}
          onSwitchView={setView}
          showWorkspaceContext={view === 'Projects'}
        >
          <main className="radical-secondary-content">
            <div className="radical-secondary-inner" key={view}>
              {view === 'Projects' && (
                <ProjectsView
                  projects={projects.filter((project) => isAllMode || project.context === activeWorkspaceId)}
                  tasks={visibleTasks}
                  onCreateProject={openProjectModal}
                  onEdit={openEditModal}
                  onToggleComplete={toggleComplete}
                  onSetStatus={setTaskStatus}
                  onToggleSubtask={toggleSubtask}
                  onDelete={archiveTask}
                  onReschedule={rescheduleTask}
                  workDays={workDays}
                  workspaces={workspaces}
                />
              )}
              {view === 'Kpi' && <KpiView tasks={visibleTasks} workspaces={visibleWorkspaces} />}
              {view === 'Motivation' && <BreakSpace tasks={boardTasks} showToast={showToast} />}
              {view === 'Notepad' && <NotepadView showToast={showToast} onAddTask={openAddModal} />}
              {view === 'Archive' && <ArchiveView tasks={archivedTasks} onRestore={restoreTask} onEdit={openEditModal} workDays={workDays} workspaces={workspaces} workspaceLabel={isAllMode ? 'كل المساحات' : activeWorkspace?.label || activeWorkspaceId} />}
              {view === 'Settings' && (
                <SettingsView
                  workDays={workDays}
                  onChangeWorkDays={(days) => setWorkDays(days)}
                  notificationSettings={notificationSettings}
                  onChangeNotificationSettings={(next) => setNotificationSettings((prev) => normalizeNotificationSettings({ ...prev, ...next }))}
                  notificationPermission={notificationPermission}
                  onRequestNotificationPermission={requestNotificationPermission}
                  onSendTestNotification={sendTestNotification}
                  pushSupported={push.supported}
                  pushSubscribed={push.subscribed}
                  pushLoading={push.loading}
                  onSubscribePush={push.subscribe}
                  onUnsubscribePush={push.unsubscribe}
                  onSendTestPush={push.sendTestPush}
                  trello={trelloForUi}
                  trelloTasks={trelloPageTasks}
                  onToggleComplete={toggleComplete}
                  onSetStatus={setTaskStatus}
                  onToggleSubtask={toggleSubtask}
                  onEdit={openEditModal}
                  onDelete={archiveTask}
                  onMoveTask={moveTask}
                  workDaysForTrello={workDays}
                  onExport={handleExport}
                  onImportFile={handleImportFile}
                />
              )}
            </div>
          </main>
        </AppFrame>
        <TaskModal isOpen={modalOpen} task={editingTask} onClose={closeModal} onSave={handleSaveTask} workDays={workDays} defaultContext={writeContextId} workspaces={visibleWorkspaces} projects={projects} />
        <ProjectModal isOpen={projectModalOpen} onClose={closeProjectModal} onSave={handleSaveProject} defaultContext={writeContextId} workspaces={visibleWorkspaces} />
        <FloatingTimer />
        <TimeTrackingSync />
        <NotesModal isOpen={Boolean(notesTarget)} taskId={notesTarget?.taskId} taskTitle={notesTarget?.title} onClose={() => setNotesTarget(null)} showToast={showToast} />
        <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
        <TaskSearch isOpen={searchOpen} onClose={() => setSearchOpen(false)} tasks={searchableTasks} workspaces={workspaces} onSelectTask={openEditModal} />
      </div>
    );
  }

  return (
    <div className="app-container">
      <div className="mobile-header">
        <div className="logo-area" style={{ marginBottom: 0 }}>
          <div className="logo-icon" style={{ width: 36, height: 36 }}>
            <img src="/logo.svg" alt="مهد" className="logo-icon-img" />
          </div>
          <div className="logo-text" style={{ fontSize: 20 }}>
            مهد
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setSearchOpen(true)}
            title="بحث (Alt+F)"
            aria-label="بحث في المهام"
          >
            <i className="ph ph-magnifying-glass" style={{ fontSize: 22 }}></i>
          </button>
          <button type="button" className="btn-icon" onClick={() => setSidebarOpen(true)}>
            <i className="ph ph-list" style={{ fontSize: 24 }}></i>
          </button>
        </div>
      </div>

      <Sidebar
        view={view}
        onSwitchView={setView}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        theme={theme}
        onToggleTheme={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
        pendingCount={pendingCount}
        trelloCount={trelloCount}
        archiveCount={archiveCount}
        totalCount={visibleTasks.length}
        connected={connected}
        onExport={handleExport}
        onImportFile={handleImportFile}
      />

      <main
        className={`main-content${workspaceSurface.id !== 'none' ? ' has-ws-surface' : ''}`}
        style={mainSurfaceStyle}
      >
        <WorkspaceSwitcher
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
          onSwitch={setActiveWorkspaceId}
          onCreate={handleCreateWorkspace}
          onUpdate={handleUpdateWorkspace}
          onArchiveSpace={handleArchiveSpace}
          onRestoreSpace={handleRestoreSpace}
          onReorder={reorderWorkspaces}
          isAllMode={isAllMode}
        />

        <div className="view-transition" key={view}>
        {view === 'Projects' && (
          <ProjectsView
            projects={projects.filter((project) => isAllMode || project.context === activeWorkspaceId)}
            tasks={visibleTasks}
            onCreateProject={async () => {
              const name = window.prompt('اسم المشروع');
              if (name?.trim()) await addProject({ name, context: writeContextId });
            }}
            onEdit={openEditModal}
            onToggleComplete={toggleComplete}
            onSetStatus={setTaskStatus}
            onToggleSubtask={toggleSubtask}
            onDelete={archiveTask}
            onReschedule={rescheduleTask}
            workDays={workDays}
            workspaces={workspaces}
          />
        )}

        {view === 'Today' && (
          <TodayView
            tasks={visibleTasks}
            onToggleComplete={toggleComplete}
            onSetStatus={setTaskStatus}
            onToggleSubtask={toggleSubtask}
            onEdit={openEditModal}
            onDelete={archiveTask}
            onAddTask={openAddModal}
            onReschedule={rescheduleTask}
            onOpenAllTasks={() => setView('Matrix')}
            workDays={workDays}
            workspaces={workspaces}
            projects={projects}
          />
        )}

        {view === 'Matrix' && (
          <div id="viewMatrix">
            <PageHeader
              eyebrow="مساحة العمل"
              title="لوحة العمل"
              description="رتّب المهام حسب أهميتها، ثم انتقل إلى الخط الزمني أو التخطيط عندما تحتاج رؤية مختلفة."
              actions={<button type="button" className="btn-primary" onClick={openAddModal}><i className="ph ph-plus" /> مهمة جديدة</button>}
            />
            <div className="matrix-topbar">
              <ViewSwitcher subview={subview} onSwitch={setSubview} />
            </div>

            {subview === 'Board' && (
              <QuadrantBoard
                tasks={boardTasks}
                onToggleComplete={toggleComplete}
                onSetStatus={setTaskStatus}
                onToggleSubtask={toggleSubtask}
                onEdit={openEditModal}
                onDelete={archiveTask}
                onMoveTask={moveTask}
                onReorderInQuadrant={reorderInQuadrant}
                onAddTask={openAddModal}
                onReschedule={rescheduleTask}
                workDays={workDays}
                workspaces={workspaces}
              />
            )}
            {subview === 'Timeline' && (
              <TimelineView
                tasks={boardTasks}
                onToggleComplete={toggleComplete}
                onSetStatus={setTaskStatus}
                onToggleSubtask={toggleSubtask}
                onEdit={openEditModal}
                onDelete={archiveTask}
                onReschedule={rescheduleTask}
                workDays={workDays}
              />
            )}
            {subview === 'Planner' && (
              <PlannerView
                tasks={boardTasks}
                onToggleComplete={toggleComplete}
                onEdit={openEditModal}
                onReschedule={rescheduleTask}
                onAddTask={openAddModal}
                workDays={workDays}
              />
            )}
            {subview === 'Gantt' && (
              <GanttView
                tasks={boardTasks}
                onToggleComplete={toggleComplete}
                onEdit={openEditModal}
                onReschedule={rescheduleTask}
                workDays={workDays}
              />
            )}
          </div>
        )}

        {view === 'Pending' && (
          <PendingView
            tasks={visibleTasks}
            onToggleComplete={toggleComplete}
            onSetStatus={setTaskStatus}
            onToggleSubtask={toggleSubtask}
            onEdit={openEditModal}
            onDelete={archiveTask}
            onAddTask={openAddModal}
            onReschedule={rescheduleTask}
            workDays={workDays}
            workspaces={workspaces}
          />
        )}

        {view === 'Kpi' && (
          <KpiView tasks={visibleTasks} workspaces={visibleWorkspaces} />
        )}

        {view === 'Motivation' && <BreakSpace tasks={boardTasks} showToast={showToast} />}

        {view === 'Notepad' && <NotepadView showToast={showToast} />}

        {view === 'Archive' && (
          <ArchiveView
            tasks={archivedTasks}
            onRestore={restoreTask}
            onEdit={openEditModal}
            workDays={workDays}
            workspaces={workspaces}
            workspaceLabel={isAllMode ? 'كل المساحات' : activeWorkspace?.label || activeWorkspaceId}
          />
        )}

        {view === 'Settings' && (
          <SettingsView
            workDays={workDays}
            onChangeWorkDays={(days) => setWorkDays(days)}
            notificationSettings={notificationSettings}
            onChangeNotificationSettings={(next) =>
              setNotificationSettings((prev) => normalizeNotificationSettings({ ...prev, ...next }))
            }
            notificationPermission={notificationPermission}
            onRequestNotificationPermission={requestNotificationPermission}
            onSendTestNotification={sendTestNotification}
            pushSupported={push.supported}
            pushSubscribed={push.subscribed}
            pushLoading={push.loading}
            onSubscribePush={push.subscribe}
            onUnsubscribePush={push.unsubscribe}
            onSendTestPush={push.sendTestPush}
            trello={trelloForUi}
            trelloTasks={trelloPageTasks}
            onToggleComplete={toggleComplete}
            onSetStatus={setTaskStatus}
            onToggleSubtask={toggleSubtask}
            onEdit={openEditModal}
            onDelete={archiveTask}
            onMoveTask={moveTask}
            workDaysForTrello={workDays}
            onExport={handleExport}
            onImportFile={handleImportFile}
          />
        )}
        </div>
      </main>

      <FloatingSmartBar
        onAddTask={addTask}
        onOpenAdvanced={openAddModal}
        activeContext={writeContextId}
      />

      <TaskModal
        isOpen={modalOpen}
        task={editingTask}
        onClose={closeModal}
        onSave={handleSaveTask}
        workDays={workDays}
        defaultContext={writeContextId}
        workspaces={visibleWorkspaces}
        projects={projects}
      />

      <FloatingTimer />
      <TimeTrackingSync />
      <NotesModal
        isOpen={Boolean(notesTarget)}
        taskId={notesTarget?.taskId}
        taskTitle={notesTarget?.title}
        onClose={() => setNotesTarget(null)}
        showToast={showToast}
      />
      <ShortcutsHelp isOpen={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <TaskSearch
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
        tasks={searchableTasks}
        workspaces={workspaces}
        onSelectTask={openEditModal}
      />
    </div>
  );
}
