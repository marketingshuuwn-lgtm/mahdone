import { startOfToday, toLocalISO } from './dateUtils';

/** تاريخ غد محلي ISO YYYY-MM-DD */
export function tomorrowISO() {
  const d = startOfToday();
  d.setDate(d.getDate() + 1);
  return toLocalISO(d);
}
