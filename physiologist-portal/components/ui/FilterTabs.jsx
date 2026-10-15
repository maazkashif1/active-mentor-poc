export default function FilterTabs({ tabs, value, onChange, counts, label = 'Filter' }) {
  return (
    <div className="filter-tabs" role="group" aria-label={label}>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          className="filter-tab"
          aria-pressed={value === tab.key}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
          <span className="tab-count">{counts?.[tab.key] ?? 0}</span>
        </button>
      ))}
    </div>
  );
}
