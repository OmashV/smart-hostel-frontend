const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" }
];

const GROUP_BY_OPTIONS = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" }
];

export default function StudentEnergyFilterBar({ filters, onChange, onRefresh, loading }) {
  return (
    <div className="student-energy-filter-bar">
      <label className="student-filter-control">
        Date Range
        <select
          value={filters.range}
          onChange={(event) => onChange({ range: event.target.value })}
          disabled={loading}
        >
          {RANGE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="student-filter-control">
        Group By
        <select
          value={filters.groupBy}
          onChange={(event) => onChange({ groupBy: event.target.value })}
          disabled={loading}
        >
          {GROUP_BY_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <button type="button" className="student-button student-button-compact" onClick={onRefresh} disabled={loading}>
        {loading ? "Refreshing..." : "Refresh"}
      </button>
    </div>
  );
}
