const SUBVIEWS = [
  { id: 'Board', icon: 'ph-squares-four', label: 'المصفوفة' },
  { id: 'Planner', icon: 'ph-calendar-blank', label: 'التقويم' },
  { id: 'Timeline', icon: 'ph-list-dashes', label: 'الخط الزمني' },
  { id: 'Gantt', icon: 'ph-chart-bar-horizontal', label: 'جانت' },
];

export default function ViewSwitcher({ subview, onSwitch }) {
  return (
    <div className="view-tabs" role="tablist">
      {SUBVIEWS.map((s) => (
        <button
          key={s.id}
          type="button"
          role="tab"
          aria-selected={subview === s.id}
          className={`view-tab ${subview === s.id ? 'active' : ''}`}
          onClick={() => onSwitch(s.id)}
        >
          <i className={`ph ${s.icon}`}></i>
          <span>{s.label}</span>
        </button>
      ))}
    </div>
  );
}
