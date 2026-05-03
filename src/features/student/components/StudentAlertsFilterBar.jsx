const RANGE_OPTIONS = [
  { value: "24h", label: "Last 24 Hours" },
  { value: "7d", label: "Last 7 Days" },
  { value: "30d", label: "Last 30 Days" }
];

const SEVERITY_OPTIONS = [
  { value: "all", label: "All Severities" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "critical", label: "Critical" }
];

export default function StudentAlertsFilterBar({
  filters,
  onChange,
  onRefresh,
  typeOptions,
  loading
}) {
  return (
    <div className="student-energy-filter-bar student-alerts-filter-bar">
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
        Alert Type
        <select
          value={filters.type}
          onChange={(event) => onChange({ type: event.target.value })}
          disabled={loading}
        >
          {typeOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="student-filter-control">
        Severity
        <select
          value={filters.severity}
          onChange={(event) => onChange({ severity: event.target.value })}
          disabled={loading}
        >
          {SEVERITY_OPTIONS.map((option) => (
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
