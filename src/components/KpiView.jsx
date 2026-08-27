import { useEffect, useMemo, useState } from 'react';
import { isTaskOverdue, startOfToday, toLocalISO } from '../utils/dateUtils';
import { DEFAULT_WORKSPACES, TRELLO_WORKSPACE_ID, normalizeTaskContext } from '../utils/taskMeta';
import PageHeader from './PageHeader';

const Q_NAMES = {
  'important-urgent': 'مهم ومستعجل',
  'important-not-urgent': 'مهم غير مستعجل',
  'not-important-urgent': 'غير مهم ومستعجل',
  'not-important-not-urgent': 'غير مهم غير مستعجل',
};
const Q_COLORS = {
  'important-urgent': 'var(--danger)',
  'important-not-urgent': 'var(--accent)',
  'not-important-urgent': 'var(--warning)',
  'not-important-not-urgent': 'var(--q4)',
};
const QUADRANTS = Object.keys(Q_NAMES);

const PERIODS = [
  { id: 'today', label: 'اليوم' },
  { id: 'week', label: 'هذا الأسبوع' },
  { id: 'month', label: 'هذا الشهر' },
  { id: 'all', label: 'الكل' },
  { id: 'custom', label: 'تاريخ محدد' },
];

const DAY_SHORT = ['أحد', 'إثن', 'ثلا', 'أرب', 'خمي', 'جمع', 'سبت'];

function reportFileName(periodLabel, extension) {
  const safe = (periodLabel || 'تقرير').replace(/\s+/g, '-');
  return `mahd-report-${safe}.${extension}`;
}

function downloadReport(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function isInPeriod(dateStr, period, customFrom, customTo) {
  if (!dateStr) return period === 'all';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return false;
  const now = new Date();
  const today = startOfDay(now);

  if (period === 'all') return true;
  if (period === 'custom') {
    if (!customFrom || !customTo) return true;
    const from = new Date(`${customFrom}T00:00:00`);
    const to = new Date(`${customTo}T23:59:59`);
    return d >= from && d <= to;
  }
  if (period === 'today') return startOfDay(d).getTime() === today.getTime();
  if (period === 'week') {
    const start = new Date(today);
    const day = start.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    start.setDate(start.getDate() + diff);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return d >= start && d < end;
  }
  if (period === 'month') {
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }
  return true;
}

/** عدّاد تصاعدي بسيط عند تغيّر القيمة */
function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const end = Number(target) || 0;
    if (end === 0) {
      setValue(0);
      return undefined;
    }
    let raf = 0;
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - (1 - t) ** 3;
      setValue(Math.round(from + (end - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
}

function AnimatedNumber({ value, suffix = '' }) {
  const n = useCountUp(value);
  return (
    <span className="kpi-count">
      {n}
      {suffix}
    </span>
  );
}

function buildLast7Days(tasks) {
  const today = startOfToday();
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = toLocalISO(d);
    const completed = tasks.filter((t) => {
      if (!t.completed) return false;
      const raw = t.completedAt || t.completed_at;
      if (!raw) return false;
      const cd = new Date(raw);
      if (Number.isNaN(cd.getTime())) return false;
      return toLocalISO(cd) === iso;
    }).length;
    days.push({
      iso,
      label: DAY_SHORT[d.getDay()],
      count: completed,
      isToday: i === 0,
    });
  }
  return days;
}

export default function KpiView({ tasks, workspaces }) {
  const [period, setPeriod] = useState('week');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [barsReady, setBarsReady] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    setBarsReady(false);
    const id = requestAnimationFrame(() => setBarsReady(true));
    return () => cancelAnimationFrame(id);
  }, [tasks, period, rangeFrom, rangeTo]);

  const spaceList = useMemo(() => {
    const list = Array.isArray(workspaces) && workspaces.length > 0 ? workspaces : DEFAULT_WORKSPACES;
    const byId = new Map(list.map((w) => [w.id, w]));
    for (const t of tasks) {
      const id = normalizeTaskContext(t.context);
      if (!byId.has(id)) {
        byId.set(id, {
          id,
          label: id,
          icon: 'ph-folder',
          color: 'var(--accent)',
          bg: 'var(--accent-light)',
        });
      }
    }
    return [...byId.values()];
  }, [workspaces, tasks]);

  const stats = useMemo(() => {
    const completedInPeriod = tasks.filter(
      (t) => t.completed && isInPeriod(t.completedAt || t.createdAt, period, rangeFrom, rangeTo)
    );
    const createdInPeriod = tasks.filter((t) => isInPeriod(t.createdAt, period, rangeFrom, rangeTo));
    const pending = tasks.filter((t) => !t.completed);
    const overdue = pending.filter((t) => isTaskOverdue(t));

    const done = completedInPeriod.length;
    const scopeTotal = period === 'all' ? tasks.length : Math.max(createdInPeriod.length, done);
    const completionRate = scopeTotal > 0 ? Math.round((done / scopeTotal) * 100) : 0;
    const totalTimeSpentSeconds = tasks.reduce((sum, t) => sum + (t.timeSpentSeconds || 0), 0);

    return {
      total: period === 'all' ? tasks.length : createdInPeriod.length,
      done,
      pending: pending.length,
      overdue: overdue.length,
      completionRate,
      completedInPeriod,
      totalTimeSpentSeconds,
    };
  }, [tasks, period, rangeFrom, rangeTo]);

  const trend7 = useMemo(() => buildLast7Days(tasks), [tasks]);
  const trendMax = Math.max(1, ...trend7.map((d) => d.count));

  const periodLabel = PERIODS.find((p) => p.id === period)?.label || '';

  const timeLabel = (() => {
    const h = Math.floor(stats.totalTimeSpentSeconds / 3600);
    const m = Math.floor((stats.totalTimeSpentSeconds % 3600) / 60);
    return h > 0 ? `${h}س ${m}د` : `${m}د`;
  })();

  const exportReport = (format) => {
    const rows = [
      ['المؤشر', 'القيمة'],
      ['الفترة', periodLabel],
      ['مهام الفترة', stats.total],
      ['منجز في الفترة', stats.done],
      ['معلقة الآن', stats.pending],
      ['متأخرة', stats.overdue],
      ['نسبة الإنجاز', `${stats.completionRate}%`],
      ['الوقت المصروف', timeLabel],
      ...spaceList.map((space) => {
        const total = tasks.filter((task) => normalizeTaskContext(task.context) === space.id).length;
        const done = tasks.filter((task) => normalizeTaskContext(task.context) === space.id && task.completed).length;
        return [`مساحة: ${space.label}`, `${done}/${total}`];
      }),
    ];
    if (format === 'json') {
      downloadReport(JSON.stringify({ generatedAt: new Date().toISOString(), period: periodLabel, stats, spaces: rows.slice(8) }, null, 2), reportFileName(periodLabel, 'json'), 'application/json;charset=utf-8');
    } else {
      const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\\n');
      downloadReport(`\\ufeff${csv}`, reportFileName(periodLabel, 'csv'), 'text/csv;charset=utf-8');
    }
    setExportOpen(false);
  };

  return (
    <div className="kpi-view">
      <PageHeader
        eyebrow="رؤية العمل"
        title="التقارير والإحصائيات"
        description="اقرأ اتجاه إنجازك وتوزيع العمل، لا مجرد أرقام معزولة. اختر الفترة التي تريد فهمها."
        meta={<span>الفترة الحالية: {periodLabel}</span>}
        actions={(
          <>
            <div className="report-export-menu">
              <button type="button" className="btn-secondary" onClick={() => setExportOpen((open) => !open)}><i className="ph ph-download-simple" /> تصدير التقرير</button>
              {exportOpen && <div className="report-export-popover"><button type="button" onClick={() => exportReport('csv')}><i className="ph ph-file-csv" /> CSV</button><button type="button" onClick={() => exportReport('json')}><i className="ph ph-brackets-curly" /> JSON</button></div>}
            </div>
            <div className="period-tabs">
              {PERIODS.map((p) => (
                <button key={p.id} type="button" className={`period-tab ${period === p.id ? 'active' : ''}`} onClick={() => setPeriod(p.id)}>
                  {p.label}
                </button>
              ))}
            </div>
            {period === 'custom' && (
              <div className="filter-range-inputs">
                <input type="date" className="form-input" value={rangeFrom} onChange={(e) => setRangeFrom(e.target.value)} />
                <span>إلى</span>
                <input type="date" className="form-input" value={rangeTo} onChange={(e) => setRangeTo(e.target.value)} />
              </div>
            )}
          </>
        )}
      />

      <p className="kpi-scope-note"><i className="ph ph-info" /> «مهام الفترة» و«المنجز في الفترة» محسوبان ضمن {periodLabel}، بينما «المعلّقة» و«المتأخرة» تعرضان الحالة الحالية.</p>
      <div className="matrix-stats kpi-stats">
        <div className="matrix-stat">
          <span className="matrix-stat-value">
            <AnimatedNumber value={stats.total} />
          </span>
          <span className="matrix-stat-label">مهام الفترة</span>
        </div>
        <div className="matrix-stat">
          <span className="matrix-stat-value">
            <AnimatedNumber value={stats.done} />
          </span>
          <span className="matrix-stat-label">منجز في الفترة</span>
        </div>
        <div className="matrix-stat">
          <span className="matrix-stat-value">
            <AnimatedNumber value={stats.pending} />
          </span>
          <span className="matrix-stat-label">معلّقة الآن · الحالة الحالية</span>
        </div>
        <div className={`matrix-stat ${stats.overdue ? 'is-warn' : ''}`}>
          <span className="matrix-stat-value">
            <AnimatedNumber value={stats.overdue} />
          </span>
          <span className="matrix-stat-label">متأخرة · الحالة الحالية</span>
        </div>
      </div>

      <div className="kpi-row">
        <div className="card kpi-ring-card">
          <h3 className="kpi-section-title">نسبة الإنجاز — {periodLabel}</h3>
          <div className="kpi-ring-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="58" fill="none" stroke="var(--border-color)" strokeWidth="10" />
              <circle
                cx="70"
                cy="70"
                r="58"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 58}`}
                strokeDashoffset={`${2 * Math.PI * 58 * (1 - (barsReady ? stats.completionRate : 0) / 100)}`}
                transform="rotate(-90 70 70)"
                className="kpi-ring-progress"
              />
            </svg>
            <div className="kpi-ring-label">
              <span className="kpi-ring-value">
                <AnimatedNumber value={stats.completionRate} suffix="%" />
              </span>
              <span className="kpi-ring-sub">منجز</span>
            </div>
          </div>
          <p className="kpi-time-hint">
            <i className="ph ph-hourglass-medium" /> الوقت المصروف الإجمالي: {timeLabel}
          </p>
        </div>

        <div className="card kpi-trend-card">
          <h3 className="kpi-section-title">اتجاه الإنجاز — آخر 7 أيام</h3>
          <div className="kpi-trend-chart" role="img" aria-label="إنجاز المهام في آخر سبعة أيام">
            {trend7.map((d) => {
              const h = barsReady ? Math.max(d.count > 0 ? 12 : 4, (d.count / trendMax) * 100) : 4;
              return (
                <div key={d.iso} className={`kpi-trend-col ${d.isToday ? 'is-today' : ''}`}>
                  <span className="kpi-trend-count">{d.count}</span>
                  <div className="kpi-trend-bar-track">
                    <div
                      className="kpi-trend-bar"
                      style={{ height: `${h}%` }}
                      title={`${d.label}: ${d.count}`}
                    />
                  </div>
                  <span className="kpi-trend-label">{d.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="kpi-split">
        <div className="card">
          <h3 className="kpi-section-title">التوزيع حسب الأولوية</h3>
          <div className="kpi-dist-list">
            {QUADRANTS.map((q) => {
              const qTasks = tasks.filter((t) => t.quadrant === q).length;
              const qDone = tasks.filter((t) => t.quadrant === q && t.completed).length;
              const qPercent = tasks.length > 0 ? (qTasks / tasks.length) * 100 : 0;
              return (
                <div key={q}>
                  <div className="dist-row">
                    <span>{Q_NAMES[q]}</span>
                    <span className="dist-meta">
                      {qDone}/{qTasks}
                    </span>
                  </div>
                  <div className="dist-bar-bg">
                    <div
                      className="dist-bar-fill kpi-bar-anim"
                      style={{
                        width: barsReady ? `${qPercent}%` : '0%',
                        background: Q_COLORS[q],
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card">
          <h3 className="kpi-section-title">التوزيع حسب المساحة</h3>
          <div className="kpi-dist-list">
            {spaceList.map((ctx) => {
              const cTasks = tasks.filter((t) => normalizeTaskContext(t.context) === ctx.id).length;
              const cDone = tasks.filter(
                (t) => normalizeTaskContext(t.context) === ctx.id && t.completed
              ).length;
              const cPercent = tasks.length > 0 ? (cTasks / tasks.length) * 100 : 0;
              if (cTasks === 0 && spaceList.length > 8) return null;
              const isTrelloSpace = ctx.id === TRELLO_WORKSPACE_ID;
              return (
                <div key={ctx.id}>
                  <div className="dist-row">
                    <span className="dist-space-label">
                      <i className={`ph ${ctx.icon}`} style={{ color: ctx.color }} />
                      {ctx.label}
                      {isTrelloSpace && (
                        <span className="kpi-trello-managed-badge" title="تُدار تلقائياً من تريلو">
                          تريلو
                        </span>
                      )}
                    </span>
                    <span className="dist-meta">
                      {cDone}/{cTasks}
                    </span>
                  </div>
                  <div className="dist-bar-bg">
                    <div
                      className="dist-bar-fill kpi-bar-anim"
                      style={{
                        width: barsReady ? `${cPercent}%` : '0%',
                        background: ctx.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h3 className="kpi-section-title">آخر المهام المنجزة في الفترة</h3>
        {stats.completedInPeriod.length === 0 ? (
          <div className="matrix-empty" style={{ padding: 28 }}>
            <i className="ph ph-chart-line-up" />
            <p>لا منجزات في هذه الفترة</p>
            <span>غيّر الفترة أو أنجز مهمة لتظهر هنا</span>
          </div>
        ) : (
          <div className="kpi-recent-list">
            {stats.completedInPeriod
              .slice()
              .sort((a, b) => new Date(b.completedAt || 0) - new Date(a.completedAt || 0))
              .slice(0, 8)
              .map((t) => (
                <div key={t.id} className="kpi-recent-item">
                  <i className="ph ph-check-circle" style={{ color: 'var(--success)' }} />
                  <span className="kpi-recent-title">{t.title}</span>
                  <span className="kpi-recent-meta">{Q_NAMES[t.quadrant]}</span>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
