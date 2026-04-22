import { getSeverityTone, getStatusTone, toTitleCase } from "../utils/overviewHelpers";

export default function StudentStatusBadge({ value, kind = "status" }) {
  const tone = kind === "severity" ? getSeverityTone(value) : getStatusTone(value);
  const label = toTitleCase(value);

  return <span className={`student-status-badge ${tone}`}>{label}</span>;
}

