/**
 * سجل الجدولة = ذاكرة النظام فقط (ليست حالة ولا زراً على الصف).
 * يُحفظ داخل external_meta._scheduleLog حتى لا نحتاج عمود SQL جديد.
 */

export const SCHEDULE_REASONS = {
  defer_tomorrow: 'defer_tomorrow',
  reschedule: 'reschedule',
  park: 'park',
  unpark: 'unpark',
};

const REASON_LABELS = {
  defer_tomorrow: 'تأجيل إلى غداً',
  reschedule: 'إعادة جدولة',
  park: 'تعليق (خارج الدورة)',
  unpark: 'إعادة إلى الدورة',
};

export function reasonLabel(reason) {
  return REASON_LABELS[reason] || reason || 'تغيير موعد';
}

export function readScheduleLog(taskOrMeta) {
  const meta =
    taskOrMeta && typeof taskOrMeta === 'object' && 'externalMeta' in taskOrMeta
      ? taskOrMeta.externalMeta
      : taskOrMeta;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return [];
  const log = meta._scheduleLog;
  return Array.isArray(log) ? log : [];
}

/** يُلحق حدثاً ويُبقي آخر 40 سجلاً */
export function appendScheduleLog(meta, entry) {
  const base =
    meta && typeof meta === 'object' && !Array.isArray(meta) ? { ...meta } : {};
  const prev = Array.isArray(base._scheduleLog) ? base._scheduleLog : [];
  const next = [
    ...prev,
    {
      at: new Date().toISOString(),
      reason: entry.reason || SCHEDULE_REASONS.reschedule,
      from: entry.from ?? null,
      to: entry.to ?? null,
    },
  ].slice(-40);
  base._scheduleLog = next;
  return base;
}

export function formatScheduleLogEntry(entry) {
  if (!entry) return '';
  const when = entry.at
    ? new Date(entry.at).toLocaleString('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : '';
  const label = reasonLabel(entry.reason);
  const from = entry.from || '—';
  const to = entry.to || '—';
  if (entry.reason === 'park' || entry.reason === 'unpark') {
    return `${when} · ${label}`;
  }
  return `${when} · ${label}: ${from} → ${to}`;
}
