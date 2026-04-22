import { Link } from "react-router-dom";
import { STUDENT_ROUTE_PATHS } from "../constants/studentConstants";
import { formatTimestamp, toTitleCase } from "../utils/overviewHelpers";
import StudentEmptyState from "./StudentEmptyState";
import StudentStatusBadge from "./StudentStatusBadge";

export default function StudentAlertPreviewList({
  alerts = [],
  maxItems = 5,
  emptyTitle = "No recent alerts",
  emptyMessage = "No warning or critical room events were found in the selected window.",
  ctaLabel = "View all alerts"
}) {
  if (!alerts.length) {
    return <StudentEmptyState title={emptyTitle} message={emptyMessage} />;
  }

  return (
    <div className="student-preview-list">
      {alerts.slice(0, maxItems).map((alert) => (
        <article key={alert.id} className="student-preview-item">
          <div className="student-preview-head">
            <div className="student-preview-badges">
              <StudentStatusBadge value={alert.type} />
              <StudentStatusBadge value={alert.severity} kind="severity" />
            </div>
            <small>{formatTimestamp(alert.timestamp)}</small>
          </div>
          <p className="student-preview-message">{alert.message || "Alert event detected."}</p>
          <small className="student-preview-status">Status: {toTitleCase(alert.status || "active")}</small>
        </article>
      ))}

      <Link className="student-link-button" to={STUDENT_ROUTE_PATHS.alerts}>
        {ctaLabel}
      </Link>
    </div>
  );
}
