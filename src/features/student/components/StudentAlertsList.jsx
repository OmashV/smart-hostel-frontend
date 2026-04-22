import StudentEmptyState from "./StudentEmptyState";
import StudentStatusBadge from "./StudentStatusBadge";
import { formatTimestamp, toTitleCase } from "../utils/overviewHelpers";
import { formatAlertTypeLabel } from "../utils/alertsHelpers";

export default function StudentAlertsList({ alerts = [], selectedAlertId, onSelect }) {
  if (!alerts.length) {
    return (
      <StudentEmptyState
        title="No alerts match current filters"
        message="Try broadening date range, type, or severity filters."
      />
    );
  }

  return (
    <div className="student-alerts-list">
      {alerts.map((alert) => {
        const isActive = selectedAlertId === alert.id;

        return (
          <button
            key={alert.id}
            type="button"
            className={`student-alert-row ${isActive ? "active" : ""}`}
            onClick={() => onSelect(alert)}
          >
            <div className="student-alert-row-top">
              <div className="student-preview-badges">
                <StudentStatusBadge value={formatAlertTypeLabel(alert.type)} />
                <StudentStatusBadge value={alert.severity} kind="severity" />
              </div>
              <small>{formatTimestamp(alert.timestamp)}</small>
            </div>

            <p className="student-alert-row-message">{alert.message || "Alert message unavailable."}</p>

            <div className="student-alert-row-meta">
              <small>Status: {toTitleCase(alert.status || "active")}</small>
            </div>
          </button>
        );
      })}
    </div>
  );
}
