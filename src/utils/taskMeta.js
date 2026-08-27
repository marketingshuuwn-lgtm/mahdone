export const WEEK_DAYS = [
  { id: 0, label: 'أحد', longLabel: 'الأحد' },
  { id: 1, label: 'إثنين', longLabel: 'الإثنين' },
  { id: 2, label: 'ثلاثاء', longLabel: 'الثلاثاء' },
  { id: 3, label: 'أربعاء', longLabel: 'الأربعاء' },
  { id: 4, label: 'خميس', longLabel: 'الخميس' },
  { id: 5, label: 'جمعة', longLabel: 'الجمعة' },
  { id: 6, label: 'سبت', longLabel: 'السبت' },
];

export const DEFAULT_WORK_DAYS = [0, 1, 2, 3, 4];
export const ALL_WEEK_DAYS = [0, 1, 2, 3, 4, 5, 6];

/** وضع عرض كل المساحات (ليس context في قاعدة البيانات) */
export const ALL_WORKSPACES_ID = '__all__';

/** مساحة مهام تريلو الافتراضية */
export const TRELLO_WORKSPACE_ID = 'alama';

/**
 * تسميات معروفة — لا تُفرض على مساحات المستخدم إن وُجدت تسمية محفوظة.
 * تُستخدم فقط عند إنشاء صف افتراضي ناقص أو استعادة من context المهام.
 */
export const WORKSPACE_LABEL_HINTS = {
  work: 'مشاريعي',
  personal: 'شخصي',
  [TRELLO_WORKSPACE_ID]: 'علامة',
  trello: 'تريلو',
  alama: 'علامة',
};

/** المساحات الافتراضية في التثبيت النظيف فقط */
export const DEFAULT_WORKSPACES = [
  {
    id: 'work',
    label: WORKSPACE_LABEL_HINTS.work,
    icon: 'ph-briefcase',
    color: 'var(--accent)',
    bg: 'var(--accent-light)',
    isDefault: true,
    surface: 'none',
  },
  {
    id: 'personal',
    label: WORKSPACE_LABEL_HINTS.personal,
    icon: 'ph-house-line',
    color: 'var(--success)',
    bg: 'var(--success-light)',
    isDefault: true,
    surface: 'none',
  },
  {
    id: TRELLO_WORKSPACE_ID,
    label: WORKSPACE_LABEL_HINTS[TRELLO_WORKSPACE_ID],
    icon: 'ph-kanban',
    color: '#0079bf',
    bg: 'rgba(0, 121, 191, 0.12)',
    isDefault: true,
    trait: 'مهام تريلو',
    surface: 'trello',
  },
];

/** للتوافق مع الكود القديم */
export const TASK_CONTEXTS = DEFAULT_WORKSPACES;

export const WORKSPACE_COLORS = [
  { color: 'var(--accent)', bg: 'var(--accent-light)', name: 'أخضر مهد' },
  { color: 'var(--success)', bg: 'var(--success-light)', name: 'أخضر هادئ' },
  { color: 'var(--warning)', bg: 'var(--warning-light)', name: 'كهرماني' },
  { color: 'var(--danger)', bg: 'var(--danger-light)', name: 'أحمر' },
  { color: '#7c3aed', bg: 'rgba(124, 58, 237, 0.12)', name: 'بنفسجي' },
  { color: '#0891b2', bg: 'rgba(8, 145, 178, 0.12)', name: 'سماوي' },
  { color: '#db2777', bg: 'rgba(219, 39, 119, 0.12)', name: 'وردي' },
  { color: '#ea580c', bg: 'rgba(234, 88, 12, 0.12)', name: 'برتقالي' },
  { color: '#0079bf', bg: 'rgba(0, 121, 191, 0.12)', name: 'تريلو' },
  { color: '#0f766e', bg: 'rgba(15, 118, 110, 0.12)', name: 'تركوازي' },
  { color: '#4f46e5', bg: 'rgba(79, 70, 229, 0.12)', name: 'نيلي' },
  { color: '#64748b', bg: 'rgba(100, 116, 139, 0.14)', name: 'رمادي' },
];

/**
 * خلفيات سطح المساحة — تدرجات + ألوان صلبة (بدون صور).
 * css يُطبَّق كطبقة تحت المحتوى مع غطاء قراءة خفيف.
 * dark: true → تدرج/لون داكن.
 *
 * ملاحظة: الألوان الصلبة تُحوَّل في getWorkspaceBackground إلى linear-gradient
 * لأن background-image لا يقبل hex مباشرة.
 */
export const WORKSPACE_BACKGROUNDS = [
  { id: 'none', name: 'افتراضي', kind: 'none', css: '', emoji: '∅' },
  {
    id: 'frost',
    name: 'صقيع',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #eef4ff 0%, #d9e8fc 55%, #cfe0f8 100%)',
    emoji: '❄️',
  },
  {
    id: 'ocean',
    name: 'محيط',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #0b3d78 0%, #1565a8 45%, #1f8fd4 100%)',
    emoji: '🌊',
    dark: true,
  },
  {
    id: 'aurora',
    name: 'شفق',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #3b1d6e 0%, #6b3fa0 50%, #9b6bc9 100%)',
    emoji: '🔮',
    dark: true,
  },
  {
    id: 'prism',
    name: 'منشور',
    kind: 'gradient',
    css: 'linear-gradient(135deg, #7c3aed 0%, #db2777 50%, #f59e0b 100%)',
    emoji: '🌈',
    dark: true,
  },
  {
    id: 'sunset',
    name: 'غروب',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #ea580c 0%, #f97316 40%, #fb923c 100%)',
    emoji: '🧡',
    dark: true,
  },
  {
    id: 'blossom',
    name: 'زهر',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #db2777 0%, #f472b6 55%, #fbcfe8 100%)',
    emoji: '🌸',
    dark: true,
  },
  {
    id: 'earth',
    name: 'أرض',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #0f766e 0%, #14b8a6 50%, #5eead4 100%)',
    emoji: '🌍',
    dark: true,
  },
  {
    id: 'midnight',
    name: 'منتصف الليل',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #0f172a 0%, #1e293b 55%, #334155 100%)',
    emoji: '👽',
    dark: true,
  },
  {
    id: 'ember',
    name: 'جمر',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #450a0a 0%, #7f1d1d 45%, #b45309 100%)',
    emoji: '🔥',
    dark: true,
  },
  {
    id: 'trello',
    name: 'تريلو',
    kind: 'gradient',
    css: 'linear-gradient(145deg, #026aa7 0%, #0079bf 50%, #5ba4cf 100%)',
    emoji: '📋',
    dark: true,
  },
  // صلبة — تُلف كـ gradient في getWorkspaceBackground
  { id: 'solid-blue', name: 'أزرق', kind: 'solid', css: '#2563eb', emoji: '', dark: true },
  { id: 'solid-gold', name: 'ذهبي', kind: 'solid', css: '#ca8a04', emoji: '', dark: true },
  { id: 'solid-green', name: 'أخضر', kind: 'solid', css: '#16a34a', emoji: '', dark: true },
  { id: 'solid-red', name: 'أحمر', kind: 'solid', css: '#b91c1c', emoji: '', dark: true },
  { id: 'solid-violet', name: 'بنفسجي', kind: 'solid', css: '#7c3aed', emoji: '', dark: true },
  { id: 'solid-pink', name: 'وردي', kind: 'solid', css: '#db2777', emoji: '', dark: true },
  { id: 'solid-lime', name: 'ليموني', kind: 'solid', css: '#65a30d', emoji: '', dark: true },
  { id: 'solid-cyan', name: 'سماوي', kind: 'solid', css: '#0891b2', emoji: '', dark: true },
  { id: 'solid-slate', name: 'رمادي', kind: 'solid', css: '#64748b', emoji: '', dark: true },
];

/** يعيد تعريف الخلفية مع css صالح دائماً لـ background-image */
export function getWorkspaceBackground(surfaceId) {
  const id = surfaceId || 'none';
  const found = WORKSPACE_BACKGROUNDS.find((b) => b.id === id) || WORKSPACE_BACKGROUNDS[0];
  let css = found.css || '';
  // hex/rgb وحدها غير صالحة كـ background-image
  if (found.kind === 'solid' && css && !/gradient/i.test(css)) {
    css = `linear-gradient(180deg, ${css}, ${css})`;
  }
  return { ...found, css };
}

export const WORKSPACE_ICONS = [
  'ph-briefcase',
  'ph-house-line',
  'ph-kanban',
  'ph-book-open',
  'ph-folder',
  'ph-star',
  'ph-heart',
  'ph-target',
  'ph-lightbulb',
  'ph-users',
  'ph-code',
  'ph-palette',
  'ph-rocket-launch',
  'ph-graduation-cap',
  'ph-leaf',
  'ph-music-notes',
  'ph-camera',
  'ph-chart-line-up',
  'ph-handshake',
  'ph-sparkle',
];

/**
 * مساحات النظام — لا تُؤرشف ولا تُحذف.
 * مشاريعي / شخصي / علامة (تريلو) + أي isDefault.
 */
export function isSystemWorkspace(wsOrId) {
  if (wsOrId == null) return true;
  const id = typeof wsOrId === 'string' ? wsOrId : wsOrId.id;
  const ws = typeof wsOrId === 'object' ? wsOrId : null;
  if (ws?.isDefault) return true;
  if (!id || typeof id !== 'string') return false;
  const nid = id.trim().toLowerCase();
  return (
    nid === 'work' ||
    nid === 'personal' ||
    nid === TRELLO_WORKSPACE_ID ||
    nid === 'alama' ||
    nid === 'trello' ||
    nid === 'علامة'
  );
}

export function normalizeWorkDays(days) {
  const source = Array.isArray(days) ? days : DEFAULT_WORK_DAYS;
  const unique = [...new Set(source.map(Number).filter((n) => n >= 0 && n <= 6))].sort((a, b) => a - b);
  return unique.length > 0 ? unique : DEFAULT_WORK_DAYS;
}

export function formatWorkDays(days, { long = false } = {}) {
  const normalized = normalizeWorkDays(days);
  return normalized
    .map((dayId) => {
      const day = WEEK_DAYS.find((d) => d.id === dayId);
      return long ? day?.longLabel : day?.label;
    })
    .filter(Boolean)
    .join('، ');
}

/** أي نص غير فارغ = معرف مساحة صالح؛ الفارغ/null → work */
export function normalizeTaskContext(context) {
  if (typeof context === 'string' && context.trim()) return context.trim();
  return 'work';
}

export function getTaskContextMeta(context, workspaces = null) {
  const id = normalizeTaskContext(context);
  const list = Array.isArray(workspaces) && workspaces.length > 0 ? workspaces : DEFAULT_WORKSPACES;
  const found = list.find((item) => item.id === id);
  if (found) return found;
  const hint = WORKSPACE_LABEL_HINTS[id];
  return {
    id,
    label: hint || id,
    icon: id === TRELLO_WORKSPACE_ID || id === 'trello' ? 'ph-kanban' : 'ph-folder',
    color: id === TRELLO_WORKSPACE_ID || id === 'trello' ? '#0079bf' : 'var(--accent)',
    bg:
      id === TRELLO_WORKSPACE_ID || id === 'trello'
        ? 'rgba(0, 121, 191, 0.12)'
        : 'var(--accent-light)',
    surface: 'none',
  };
}

export function slugifyWorkspaceName(name) {
  const base = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\u0600-\u06FF-]/g, '')
    .slice(0, 40);
  return base || `ws-${Date.now().toString(36)}`;
}

/** يبني مساحة من معرف context إن لم تكن في القائمة */
export function workspaceFromContextId(id, index = 0) {
  const nid = normalizeTaskContext(id);
  const def = DEFAULT_WORKSPACES.find((w) => w.id === nid);
  if (def) {
    return {
      ...def,
      archived: false,
      trait: def.trait || '',
      description: '',
      surface: def.surface || 'none',
    };
  }
  const palette = WORKSPACE_COLORS[index % WORKSPACE_COLORS.length];
  const isTrello = nid === 'trello' || nid === TRELLO_WORKSPACE_ID;
  return {
    id: nid,
    label: WORKSPACE_LABEL_HINTS[nid] || nid,
    icon: isTrello ? 'ph-kanban' : WORKSPACE_ICONS[index % WORKSPACE_ICONS.length],
    color: isTrello ? '#0079bf' : palette.color,
    bg: isTrello ? 'rgba(0, 121, 191, 0.12)' : palette.bg,
    isDefault: false,
    archived: false,
    trait: isTrello ? 'مهام تريلو' : '',
    description: '',
    surface: isTrello ? 'trello' : 'none',
  };
}
