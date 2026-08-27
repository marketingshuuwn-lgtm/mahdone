import * as XLSX from 'xlsx';
import { normalizeSubtasks } from './subtasks';
import { normalizeTaskContext } from './taskMeta';

const HEADERS = [
  'Title',
  'Quadrant',
  'Context',
  'Completed',
  'Notes',
  'Subtasks',
  'DueDate',
  'Duration',
  'Recurrence',
  'RecurrenceDays',
];

function tasksToRows(tasks) {
  return tasks.map((t) => ({
    Title: t.title,
    Quadrant: t.quadrant,
    Context: normalizeTaskContext(t.context),
    Completed: t.completed,
    Notes: t.notes || '',
    Subtasks: JSON.stringify(normalizeSubtasks(t.subtasks)),
    DueDate: t.dueDate || '',
    Duration: t.duration || 1,
    Recurrence: t.recurrence || '',
    RecurrenceDays: Array.isArray(t.recurrenceDays) ? t.recurrenceDays.join('|') : '',
  }));
}

export function exportTasksAsCsv(tasks) {
  const rows = tasksToRows(tasks);
  const escape = (v) => `"${String(v).replace(/"/g, '""')}"`;
  const lines = [HEADERS.join(',')].concat(
    rows.map((r) => HEADERS.map((h) => escape(r[h])).join(','))
  );
  const csv = '\uFEFF' + lines.join('\n');
  downloadBlob(csv, 'text/csv;charset=utf-8;', 'مهام-مهد.csv');
}

export function exportTasksAsXlsx(tasks) {
  const rows = tasksToRows(tasks);
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'المهام');
  XLSX.writeFile(wb, 'مهام-مهد.xlsx');
}

function downloadBlob(content, mime, filename) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line) {
  const result = [];
  let insideQuote = false;
  let currentVal = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (insideQuote && line[i + 1] === '"') {
        currentVal += '"';
        i++;
      } else {
        insideQuote = !insideQuote;
      }
    } else if (char === ',' && !insideQuote) {
      result.push(currentVal);
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  result.push(currentVal);
  return result;
}

function parseRecurrenceDays(value) {
  if (Array.isArray(value)) return value.map(Number).filter((n) => n >= 0 && n <= 6);
  if (value == null || value === '') return [];
  return String(value)
    .split(/[|،,;\s]+/)
    .map(Number)
    .filter((n) => n >= 0 && n <= 6);
}

function parseSubtasks(value) {
  if (!value) return [];
  if (Array.isArray(value)) return normalizeSubtasks(value);
  try {
    return normalizeSubtasks(JSON.parse(String(value)));
  } catch {
    return normalizeSubtasks(
      String(value)
        .split(/[|؛;\n]+/)
        .map((title, index) => ({ id: `imported-${index}-${title}`, title, completed: false, sortOrder: index }))
    );
  }
}

function normalizeImportedTask(row) {
  const recurrence = row.recurrence === 'daily' || row.recurrence === 'weekly' ? row.recurrence : null;
  return {
    title: row.title || 'مهمة',
    quadrant: row.quadrant || 'important-urgent',
    context: normalizeTaskContext(row.context),
    subtasks: parseSubtasks(row.subtasks),
    completed: row.completed === true || String(row.completed).toLowerCase() === 'true',
    notes: row.notes || '',
    dueDate: row.dueDate || '',
    duration: parseInt(row.duration, 10) || 1,
    recurrence,
    recurrenceDays: recurrence === 'weekly' ? parseRecurrenceDays(row.recurrenceDays) : [],
  };
}

// يقرأ ملف مستورد (csv أو xlsx) ويرجّع Promise بمصفوفة مهام موحّدة الشكل
export function readImportFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذّرت قراءة الملف'));
    reader.onload = (e) => {
      try {
        let importedData = [];
        if (ext === 'csv') {
          const text = e.target.result.replace(/^\uFEFF/, '');
          const lines = text.split(/\r?\n/).filter((l) => l.trim() !== '');
          if (lines.length === 0) {
            resolve([]);
            return;
          }
          const header = parseCsvLine(lines[0]).map((h) => h.trim());
          const hasNamedHeader = header.includes('Title') || header.includes('title');

          for (let i = 1; i < lines.length; i++) {
            const parts = parseCsvLine(lines[i]);
            if (parts.length < 2) continue;

            if (hasNamedHeader) {
              const row = Object.fromEntries(header.map((h, idx) => [h, parts[idx] ?? '']));
              importedData.push(
                normalizeImportedTask({
                  title: row.Title || row.title,
                  quadrant: row.Quadrant || row.quadrant,
                  context: row.Context || row.context,
                  completed: row.Completed || row.completed,
                  notes: row.Notes || row.notes,
                  subtasks: row.Subtasks || row.subtasks,
                  dueDate: row.DueDate || row.dueDate,
                  duration: row.Duration || row.duration,
                  recurrence: row.Recurrence || row.recurrence,
                  recurrenceDays: row.RecurrenceDays || row.recurrenceDays,
                })
              );
            } else if (parts.length >= 5) {
              // توافق مع الصيغة القديمة: Title, Quadrant, Completed, Notes, DueDate, Duration
              importedData.push(
                normalizeImportedTask({
                  title: parts[0],
                  quadrant: parts[1],
                  completed: parts[2],
                  notes: parts[3],
                  dueDate: parts[4],
                  duration: parts[5],
                })
              );
            }
          }
        } else if (ext === 'xlsx') {
          const data = new Uint8Array(e.target.result);
          const wb = XLSX.read(data, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const json = XLSX.utils.sheet_to_json(ws);
          json.forEach((row) => {
            importedData.push(
              normalizeImportedTask({
                title: row.Title || row.title,
                quadrant: row.Quadrant || row.quadrant,
                context: row.Context || row.context,
                completed: row.Completed ?? row.completed,
                notes: row.Notes || row.notes,
                subtasks: row.Subtasks || row.subtasks,
                dueDate: row.DueDate || row.dueDate,
                duration: row.Duration || row.duration,
                recurrence: row.Recurrence || row.recurrence,
                recurrenceDays: row.RecurrenceDays || row.recurrenceDays,
              })
            );
          });
        } else {
          reject(new Error('صيغة الملف غير مدعومة (csv أو xlsx فقط)'));
          return;
        }
        resolve(importedData);
      } catch (err) {
        reject(err);
      }
    };
    if (ext === 'xlsx') reader.readAsArrayBuffer(file);
    else reader.readAsText(file);
  });
}
