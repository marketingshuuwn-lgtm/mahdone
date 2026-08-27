export function createSubtask(title = '') {
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `sub-${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return {
    id,
    title: String(title || ''),
    completed: false,
    sortOrder: 0,
  };
}

/**
 * @param {unknown} subtasks
 * @param {{ forSave?: boolean }} [opts] — forSave=true يقصّ الفراغات ويحذف الفارغ (عند الحفظ فقط)
 */
export function normalizeSubtasks(subtasks, opts = {}) {
  const forSave = Boolean(opts.forSave);
  if (!Array.isArray(subtasks)) return [];

  const mapped = subtasks.map((item, index) => {
    if (typeof item === 'string') {
      const title = forSave ? item.trim() : item;
      return {
        id: `sub-${index}-${item}`,
        title,
        completed: false,
        sortOrder: index,
      };
    }

    const rawTitle = String(item?.title ?? '');
    return {
      id: item?.id || `sub-${index}-${Date.now()}`,
      title: forSave ? rawTitle.trim() : rawTitle,
      completed: !!item?.completed,
      sortOrder: Number.isFinite(Number(item?.sortOrder ?? item?.sort_order))
        ? Number(item?.sortOrder ?? item?.sort_order)
        : index,
    };
  });

  const list = forSave ? mapped.filter((item) => item.title.trim()) : mapped;
  return list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function getSubtaskStats(subtasks) {
  const normalized = normalizeSubtasks(subtasks, { forSave: true });
  const total = normalized.length;
  const completed = normalized.filter((item) => item.completed).length;
  return {
    total,
    completed,
    pending: total - completed,
    percent: total > 0 ? Math.round((completed / total) * 100) : 0,
  };
}
