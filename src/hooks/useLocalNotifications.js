import { useEffect } from 'react';
import { getOccurrenceDates, isTaskOverdue, startOfToday } from '../utils/dateUtils';
import { normalizeWorkDays } from '../utils/taskMeta';

const SENT_PREFIX = 'mahd_notification_sent_v1';

function canNotify() {
  return typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted';
}

function minuteOfNow(date = new Date()) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function storageKey(type, dayIso, time) {
  return `${SENT_PREFIX}:${type}:${dayIso}:${time}`;
}

function wasSent(type, dayIso, time) {
  return localStorage.getItem(storageKey(type, dayIso, time)) === '1';
}

function markSent(type, dayIso, time) {
  localStorage.setItem(storageKey(type, dayIso, time), '1');
}

export function notify(title, body) {
  if (!canNotify()) return;
  new Notification(title, {
    body,
    icon:
      "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Crect width='64' height='64' rx='16' fill='%234f6bed'/%3E%3Cpath d='M18 34l10 10 18-22' stroke='white' stroke-width='6' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E",
  });
}

function getTodayIso(today) {
  const y = today.getFullYear();
  const m = String(today.getMonth() + 1).padStart(2, '0');
  const d = String(today.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getTodayTasks(tasks, workDays, today) {
  return tasks.filter((task) => {
    if (task.completed) return false;
    return getOccurrenceDates(task, today, today, { workDays }).length > 0;
  });
}

export function sendNotificationPreview() {
  if (!canNotify()) return false;
  notify('تجربة تنبيه مهد', 'التنبيهات تعمل. سنرسل الملخصات عندما يكون تبويب مهد مفتوحاً.');
  return true;
}

export function useLocalNotifications(tasks, workDays, settings) {
  useEffect(() => {
    if (!settings?.enabled) return undefined;
    if (!canNotify()) return undefined;

    const activeDays = normalizeWorkDays(settings.activeDays);
    const effectiveWorkDays = normalizeWorkDays(workDays);

    const tick = () => {
      const now = new Date();
      const today = startOfToday();
      const todayIso = getTodayIso(today);
      const currentMinute = minuteOfNow(now);

      if (!activeDays.includes(today.getDay())) return;

      const todayTasks = getTodayTasks(tasks, effectiveWorkDays, today);
      const overdue = tasks.filter((task) => !task.completed && isTaskOverdue(task));

      if (
        settings.morningSummary &&
        currentMinute === settings.morningTime &&
        !wasSent('morning', todayIso, settings.morningTime)
      ) {
        notify(
          'ملخص مهد الصباحي',
          todayTasks.length > 0
            ? `لديك ${todayTasks.length} مهمة مجدولة اليوم. ابدأ بأصغر خطوة.`
            : 'لا توجد مهام مجدولة اليوم. يومك خفيف ومنظم.'
        );
        markSent('morning', todayIso, settings.morningTime);
      }

      if (
        settings.eveningReview &&
        currentMinute === settings.eveningTime &&
        !wasSent('evening', todayIso, settings.eveningTime)
      ) {
        const remainingToday = todayTasks.length;
        notify(
          'مراجعة مهد المسائية',
          overdue.length > 0
            ? `${overdue.length} متأخرة، و${remainingToday} متبقية من مهام اليوم.`
            : remainingToday > 0
              ? `${remainingToday} مهمة متبقية اليوم. راجعها أو أعد جدولتها بهدوء.`
              : 'ممتاز — لا توجد مهام متبقية اليوم.'
        );
        markSent('evening', todayIso, settings.eveningTime);
      }
    };

    const starter = window.setTimeout(tick, 1000);
    const interval = window.setInterval(tick, 30 * 1000);
    return () => {
      window.clearTimeout(starter);
      window.clearInterval(interval);
    };
  }, [tasks, workDays, settings]);
}
