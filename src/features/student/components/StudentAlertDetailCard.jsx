import StudentEmptyState from "./StudentEmptyState";
import StudentStatusBadge from "./StudentStatusBadge";
import { formatTimestamp, toTitleCase } from "../utils/overviewHelpers";
import { formatAlertTypeLabel } from "../utils/alertsHelpers";

export default function StudentAlertDetailCard({ alert }) {
  if (!alert) {
    return (
      <StudentEmptyState
        title="Select an alert"
        message="Choose an alert from the list to inspect more details."
      />
    );
  }

  const showSoundPeak = Number.isFinite(Number(alert.soundPeak)) && Number(alert.soundPeak) > 0;

  return (
    <div className="student-alert-detail">
      <div className="student-alert-detail-head">
        <h4>{formatAlertTypeLabel(alert.type)} Alert</h4>
        <div className="student-preview-badges">
          <StudentStatusBadge value={alert.severity} kind="severity" />
          <StudentStatusBadge value={alert.status || "active"} />
        </div>
      </div>

      <p className="student-alert-detail-message">{alert.message || "Alert message unavailable."}</p>

      <dl className="student-alert-detail-grid">
        <div>
          <dt>Timestamp</dt>
          <dd>{formatTimestamp(alert.timestamp)}</dd>
        </div>
        <div>
          <dt>Type</dt>
          <dd>{formatAlertTypeLabel(alert.type)}</dd>
        </div>
        <div>
          <dt>Severity</dt>
          <dd>{toTitleCase(alert.severity)}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{toTitleCase(alert.status || "active")}</dd>
        </div>
        <div>
          <dt>Source Reading ID</dt>
          <dd>{alert.sourceReadingId || "--"}</dd>
        </div>
        <div>
          <dt>Noise Peak Context</dt>
          <dd>{showSoundPeak ? `${Number(alert.soundPeak).toFixed(2)} peak` : "--"}</dd>
        </div>
      </dl>
    </div>
  );
}
