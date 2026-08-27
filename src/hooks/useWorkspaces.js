import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_WORKSPACES,
  WORKSPACE_COLORS,
  WORKSPACE_ICONS,
  WORKSPACE_LABEL_HINTS,
  ALL_WORKSPACES_ID,
  getWorkspaceBackground,
  isSystemWorkspace,
  normalizeTaskContext,
  slugifyWorkspaceName,
  workspaceFromContextId,
} from '../utils/taskMeta';

const WORKSPACES_KEY = 'mahd_workspaces_v1';
const ACTIVE_KEY = 'mahd_active_workspace_v1';

function normalizeSurface(id) {
  const bg = getWorkspaceBackground(id);
  return bg?.id || 'none';
}

/** لا تستبدل تسمية المستخدم بتسمية البذرة */
function disambiguateWorkspaceLabels(list) {
  const seen = new Map();
  return list.map((workspace) => {
    const label = workspace.label || workspace.id;
    const count = (seen.get(label) || 0) + 1;
    seen.set(label, count);
    return count === 1 ? workspace : { ...workspace, label: `${label} ${count}` };
  });
}

function mergeDefaultsPreserveLabels(list) {
  const byId = new Map(list.map((w) => [w.id, w]));
  for (const def of DEFAULT_WORKSPACES) {
    if (!byId.has(def.id)) {
      byId.set(def.id, {
        ...def,
        label: WORKSPACE_LABEL_HINTS[def.id] || def.label,
        archived: false,
        trait: def.trait || '',
        description: '',
        surface: def.surface || 'none',
      });
    }
  }
  const work = byId.get('work');
  if (work && (work.label === 'عمل' || work.label === 'work')) {
    byId.set('work', { ...work, label: WORKSPACE_LABEL_HINTS.work });
  }
  return disambiguateWorkspaceLabels([...byId.values()]);
}

function readWorkspaces() {
  try {
    const raw = localStorage.getItem(WORKSPACES_KEY);
    if (!raw) {
      return DEFAULT_WORKSPACES.map((w) => ({
        ...w,
        archived: false,
        trait: w.trait || '',
        description: '',
        surface: w.surface || 'none',
      }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_WORKSPACES.map((w) => ({
        ...w,
        archived: false,
        trait: w.trait || '',
        description: '',
        surface: w.surface || 'none',
      }));
    }
    const cleaned = parsed
      .filter((w) => w && typeof w.id === 'string' && w.id.trim() && w.id !== ALL_WORKSPACES_ID)
      .map((w) => ({
        id: normalizeTaskContext(w.id),
        label: String(w.label || WORKSPACE_LABEL_HINTS[w.id] || w.id).trim() || w.id,
        icon: w.icon || 'ph-folder',
        color: w.color || 'var(--accent)',
        bg: w.bg || 'var(--accent-light)',
        isDefault: Boolean(w.isDefault),
        archived: Boolean(w.archived),
        trait: typeof w.trait === 'string' ? w.trait : '',
        description: typeof w.description === 'string' ? w.description : '',
        surface: normalizeSurface(w.surface),
      }));
    return mergeDefaultsPreserveLabels(cleaned);
  } catch {
    return DEFAULT_WORKSPACES.map((w) => ({
      ...w,
      archived: false,
      trait: w.trait || '',
      description: '',
      surface: w.surface || 'none',
    }));
  }
}

function readActiveId(workspaces) {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    if (raw === ALL_WORKSPACES_ID) return ALL_WORKSPACES_ID;
    if (raw && workspaces.some((w) => w.id === raw && !w.archived)) return raw;
  } catch {
    /* ignore */
  }
  const first = workspaces.find((w) => !w.archived);
  return first?.id || 'work';
}

export function useWorkspaces() {
  const [workspaces, setWorkspaces] = useState(readWorkspaces);
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState(() =>
    readActiveId(readWorkspaces())
  );

  useEffect(() => {
    localStorage.setItem(WORKSPACES_KEY, JSON.stringify(workspaces));
  }, [workspaces]);

  useEffect(() => {
    localStorage.setItem(ACTIVE_KEY, activeWorkspaceId);
  }, [activeWorkspaceId]);

  const visibleWorkspaces = useMemo(
    () => workspaces.filter((w) => !w.archived),
    [workspaces]
  );

  const setActiveWorkspaceId = useCallback(
    (id) => {
      if (id === ALL_WORKSPACES_ID) {
        setActiveWorkspaceIdState(ALL_WORKSPACES_ID);
        return;
      }
      const normalized = normalizeTaskContext(id);
      if (workspaces.some((w) => w.id === normalized && !w.archived)) {
        setActiveWorkspaceIdState(normalized);
      }
    },
    [workspaces]
  );

  const isAllMode = activeWorkspaceId === ALL_WORKSPACES_ID;

  const activeWorkspace = isAllMode
    ? {
        id: ALL_WORKSPACES_ID,
        label: 'الكل',
        icon: 'ph-squares-four',
        color: 'var(--text-primary)',
        bg: 'var(--border-color)',
        isDefault: false,
        archived: false,
        trait: '',
        description: '',
        surface: 'none',
      }
    : workspaces.find((w) => w.id === activeWorkspaceId) ||
      visibleWorkspaces[0] ||
      DEFAULT_WORKSPACES[0];

  const writeContextId = isAllMode
    ? visibleWorkspaces[0]?.id || 'work'
    : activeWorkspaceId;

  const ensureContextsFromTasks = useCallback((contextIds) => {
    if (!Array.isArray(contextIds) || contextIds.length === 0) return;
    const unique = [
      ...new Set(contextIds.map((c) => normalizeTaskContext(c)).filter(Boolean)),
    ];
    setWorkspaces((prev) => {
      const ids = new Set(prev.map((w) => w.id));
      const missing = unique.filter((id) => !ids.has(id));
      if (missing.length === 0) return prev;
      const additions = missing.map((id, i) =>
        workspaceFromContextId(id, prev.length + i)
      );
      return mergeDefaultsPreserveLabels([...prev, ...additions]);
    });
  }, []);

  const addWorkspace = useCallback(
    ({ name, icon, colorIndex, trait, description, surface }) => {
      const label = String(name || '').trim();
      if (!label) return null;

      const baseId = slugifyWorkspaceName(label);
      const existingIds = new Set(workspaces.map((w) => w.id));
      const id = existingIds.has(baseId)
        ? `${baseId}-${Date.now().toString(36).slice(-4)}`
        : baseId;
      const palette = WORKSPACE_COLORS[(colorIndex ?? workspaces.length) % WORKSPACE_COLORS.length];
      const duplicateLabelCount = workspaces.filter((workspace) => workspace.label === label).length;
      const displayLabel = duplicateLabelCount ? `${label} ${duplicateLabelCount + 1}` : label;
      const next = {
        id,
        label: displayLabel,
        icon: icon || WORKSPACE_ICONS[workspaces.length % WORKSPACE_ICONS.length],
        color: palette.color,
        bg: palette.bg,
        isDefault: false,
        archived: false,
        trait: typeof trait === 'string' ? trait.trim() : '',
        description: typeof description === 'string' ? description.trim().slice(0, 200) : '',
        surface: normalizeSurface(surface),
      };

      setWorkspaces((prev) => (prev.some((w) => w.id === id) ? prev : [...prev, next]));
      setActiveWorkspaceIdState(id);
      return { id, label };
    },
    [workspaces]
  );

  const updateWorkspace = useCallback((id, patch) => {
    setWorkspaces((prev) =>
      prev.map((w) => {
        if (w.id !== id) return w;
        const next = { ...w };
        if (patch.label != null) {
          const label = String(patch.label).trim();
          if (label) next.label = label;
        }
        if (patch.icon) next.icon = patch.icon;
        if (patch.colorIndex != null) {
          const palette = WORKSPACE_COLORS[patch.colorIndex % WORKSPACE_COLORS.length];
          next.color = palette.color;
          next.bg = palette.bg;
        }
        if (patch.color) next.color = patch.color;
        if (patch.bg) next.bg = patch.bg;
        if (patch.trait !== undefined) next.trait = String(patch.trait || '').trim();
        if (patch.description !== undefined) {
          next.description = String(patch.description || '').trim().slice(0, 200);
        }
        if (patch.surface !== undefined) {
          next.surface = normalizeSurface(patch.surface);
        }
        return next;
      })
    );
  }, []);

  const archiveWorkspace = useCallback((id) => {
    const target = workspaces.find((w) => w.id === id);
    if (isSystemWorkspace(target || id)) return false;
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, archived: true } : w))
    );
    setActiveWorkspaceIdState((cur) => (cur === id ? ALL_WORKSPACES_ID : cur));
    return true;
  }, [workspaces]);

  const restoreWorkspace = useCallback((id) => {
    setWorkspaces((prev) =>
      prev.map((w) => (w.id === id ? { ...w, archived: false } : w))
    );
  }, []);

  const reorderWorkspaces = useCallback((draggedId, targetId) => {
    if (draggedId === targetId) return;
    setWorkspaces((prev) => {
      const list = [...prev];
      const fromIdx = list.findIndex((w) => w.id === draggedId);
      const toIdx = list.findIndex((w) => w.id === targetId);
      if (fromIdx === -1 || toIdx === -1) return prev;
      const [moved] = list.splice(fromIdx, 1);
      const insertAt = list.findIndex((w) => w.id === targetId);
      list.splice(insertAt, 0, moved);
      return list;
    });
  }, []);

  return {
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
  };
}
