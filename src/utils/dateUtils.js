/** تنسيق تاريخ محلي بدون مشاكل UTC */
import { DEFAULT_WORK_DAYS, formatWorkDays, normalizeWorkDays } from './taskMeta';
import { isCompletedToday, normalizeTaskStatus } from './taskStatus';

export function toLocalISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

export function startOfToday() {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  return d;
}

export function isRecurringTask(task) {
  return task?.recurrence === 'daily' || task?.recurrence === 'weekly';
}

export function getTaskStartDate(task) {
  return parseLocalDate(task?.dueDate);
}

export function getTaskEndDate(task) {
  const start = getTaskStartDate(task);
  if (!start) return null;
  const lifetime = Math.max(1, Number(task.duration) || 1);
  const end = new Date(start);
  end.setDate(end.getDate() + (lifetime - 1));
  return end;
}

export function getTaskEndISO(task) {
  const end = getTaskEndDate(task);
  return end ? toLocalISO(end) : '';
}

const DAY_LABELS = ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];

function resolveDailyWorkDays(options = {}) {
  if (Array.isArray(options.workDays)) return normalizeWorkDays(options.workDays);
  if (options.skipFriday === false) return EVERY_DAY;
  return DEFAULT_WORK_DAYS;
}

export function getOccurrenceDates(task, fromDate, toDate, options = {}) {
  const out = [];
  if (!task) return out;

  const windowFrom = new Date(fromDate);
  windowFrom.setHours(12, 0, 0, 0);
  const windowTo = new Date(toDate);
  windowTo.setHours(12, 0, 0, 0);

  const start = getTaskStartDate(task);
  const end = getTaskEndDate(task);

  if (!start) return out;

  const rangeFrom = start > windowFrom ? start : windowFrom;
  const rangeTo = end && end < windowTo ? end : windowTo;
  if (rangeFrom > rangeTo) return out;

  if (task.recurrence === 'weekly') {
    const days = Array.isArray(task.recurrenceDays)
      ? task.recurrenceDays.map(Number).filter((n) => n >= 0 && n <= 6)
      : [];
    if (days.length === 0) return out;
    const cursor = new Date(rangeFrom);
    while (cursor <= rangeTo) {
      if (days.includes(cursor.getDay())) out.push(toLocalISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  if (task.recurrence === 'daily') {
    const workDays = resolveDailyWorkDays(options);
    const cursor = new Date(rangeFrom);
    while (cursor <= rangeTo) {
      if (workDays.includes(cursor.getDay())) out.push(toLocalISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }

  const cursor = new Date(rangeFrom);
  while (cursor <= rangeTo) {
    out.push(toLocalISO(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

/**
 * متأخرة:
 * - ملغاة / مؤجلة / منجزة (لليوم إن كانت دورية) → لا
 * - دورية: يوجد حدوث قبل اليوم ضمن العمر ولم تُنجز اليوم
 * - عادية: تاريخ النهاية قبل اليوم
 */
export function isTaskOverdue(task, options = {}) {
  if (!task) return false;
  const status = normalizeTaskStatus(task);
  if (status === 'cancelled' || status === 'deferred') return false;
  if (task.archived) return false;

  const doneToday = () =>
    isCompletedToday(task, null, toLocalISO, startOfToday);

  if (status === 'completed' || task.completed) {
    if (!isRecurringTask(task)) return false;
    if (doneToday()) return false;
  }

  const today = startOfToday();
  const start = getTaskStartDate(task);
  const end = getTaskEndDate(task);

  if (isRecurringTask(task)) {
    if (!start) return false;
    if (end && end < today) return true; // انتهت السلسلة بلا إنجاز مستمر
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (yesterday < start) return false;
    const pastOcc = getOccurrenceDates(task, start, yesterday, options);
    if (pastOcc.length === 0) return false;
    return !doneToday();
  }

  if (!end) return false;
  return end < today;
}

export function formatDate(dateStr) {
  if (!dateStr || dateStr === 'غير محدد') return 'بدون تاريخ';
  try {
    const d = parseLocalDate(dateStr);
    if (!d) return 'بدون تاريخ';
    return d.toLocaleDateString('ar-EG', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  } catch (e) {
    return 'بدون تاريخ';
  }
}

export function formatTaskSchedule(task, options = {}) {
  if (!task) return 'بدون تاريخ';

  const life = Math.max(1, Number(task.duration) || 1);
  const range =
    task.dueDate && life > 1
      ? ` · ${formatDate(task.dueDate)} → ${formatDate(getTaskEndISO(task))}`
      : task.dueDate
        ? ` · ${formatDate(task.dueDate)}`
        : '';

  if (task.recurrence === 'daily') {
    const days = formatWorkDays(resolveDailyWorkDays(options));
    return `يومياً في أيام العمل (${days})${range}`;
  }
  if (task.recurrence === 'weekly') {
    const days = Array.isArray(task.recurrenceDays) ? task.recurrenceDays : [];
    if (days.length === 0) return `أسبوعياً${range}`;
    const labels = [...days].sort((a, b) => a - b).map((d) => DAY_LABELS[d] || d);
    return `كل ${labels.join('، ')}${range}`;
  }

  if (!task.dueDate) return 'بدون تاريخ';
  if (life <= 1) return formatDate(task.dueDate);
  return `${formatDate(task.dueDate)} → ${formatDate(getTaskEndISO(task))}`;
}

export function taskScheduleSortKey(task, options = {}) {
  const status = normalizeTaskStatus(task);
  if (status === 'deferred') return { bucket: 45, time: 0 };

  const doneToday = isCompletedToday(task, null, toLocalISO, startOfToday);
  const effectivelyDone =
    (status === 'completed' || task.completed) &&
    (!isRecurringTask(task) || doneToday);

  if (effectivelyDone) {
    const end = getTaskEndDate(task);
    return { bucket: 100, time: end ? end.getTime() : 0 };
  }
  const start = getTaskStartDate(task);
  const end = getTaskEndDate(task);
  if (!start) return { bucket: 50, time: Infinity };
  const today = startOfToday();
  if (isTaskOverdue(task, options)) return { bucket: 0, time: start.getTime() };

  if (isRecurringTask(task)) {
    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 14);
    const occ = getOccurrenceDates(task, today, windowEnd, options);
    if (occ.length) return { bucket: 10, time: parseLocalDate(occ[0]).getTime() };
    return { bucket: 40, time: end ? end.getTime() : 0 };
  }
  return { bucket: 10, time: start.getTime() };
}

export function compareTasksBySchedule(a, b, options = {}) {
  const ka = taskScheduleSortKey(a, options);
  const kb = taskScheduleSortKey(b, options);
  if (ka.bucket !== kb.bucket) return ka.bucket - kb.bucket;
  if (ka.time !== kb.time) return ka.time - kb.time;
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
}

const WEEKDAY_MAP = {
  احد: 0, الأحد: 0, الاحد: 0,
  اثنين: 1, الإثنين: 1, الاثنين: 1,
  ثلاثاء: 2, الثلاثاء: 2,
  اربعاء: 3, الأربعاء: 3, الاربعاء: 3,
  خميس: 4, الخميس: 4,
  جمعة: 5, الجمعة: 5,
  سبت: 6, السبت: 6,
};

function nextWeekday(targetDay) {
  const d = startOfToday();
  const current = d.getDay();
  let add = (targetDay - current + 7) % 7;
  if (add === 0) add = 7;
  d.setDate(d.getDate() + add);
  return d;
}

function parseNumericDate(text) {
  const iso = text.match(/(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})/);
  if (iso) {
    const d = new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]), 12);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dmy = text.match(/(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{4})/);
  if (dmy) {
    const d = new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]), 12);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const dm = text.match(/(\d{1,2})[\/\-.](\d{1,2})(?![\d\/\-.])/);
  if (dm) {
    const year = new Date().getFullYear();
    const d = new Date(year, Number(dm[2]) - 1, Number(dm[1]), 12);
    if (!Number.isNaN(d.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) d.setFullYear(year + 1);
      return d;
    }
  }
  return null;
}

export function parseSmartInput(text) {
  let dueDate = '';
  let title = text;
  const today = startOfToday();

  const numeric = parseNumericDate(text);
  if (numeric) {
    dueDate = toLocalISO(numeric);
    title = text
      .replace(/\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2}/, '')
      .replace(/\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{4}/, '')
      .replace(/\d{1,2}[\/\-.]\d{1,2}/, '')
      .trim();
  } else if (/\bاليوم\b/.test(text)) {
    dueDate = toLocalISO(today);
    title = text.replace(/\bاليوم\b/g, '').trim();
  } else if (/بكرة|غداً?|غدا/.test(text)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 1);
    dueDate = toLocalISO(t);
    title = text.replace(/بكرة|غداً?|غدا/g, '').trim();
  } else if (/بعد\s*أسبوع|الأسبوع\s*القادم/.test(text)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 7);
    dueDate = toLocalISO(t);
    title = text.replace(/بعد\s*أسبوع|الأسبوع\s*القادم/g, '').trim();
  } else if (/بعد\s*يومين/.test(text)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 2);
    dueDate = toLocalISO(t);
    title = text.replace(/بعد\s*يومين/g, '').trim();
  } else if (/بعد\s*ثلاثة\s*أيام|بعد\s*٣\s*أيام/.test(text)) {
    const t = new Date(today);
    t.setDate(t.getDate() + 3);
    dueDate = toLocalISO(t);
    title = text.replace(/بعد\s*ثلاثة\s*أيام|بعد\s*٣\s*أيام/g, '').trim();
  } else {
    for (const [name, dayNum] of Object.entries(WEEKDAY_MAP)) {
      const re = new RegExp(`(يوم\s*)?${name}(\s*القادم)?`);
      if (re.test(text)) {
        dueDate = toLocalISO(nextWeekday(dayNum));
        title = text.replace(re, '').trim();
        break;
      }
    }
  }

  title = title.replace(/^[-,،:\s]+|[-,،:\s]+$/g, '').replace(/\s{2,}/g, ' ');
  return { title: title || text.trim(), dueDate };
}
