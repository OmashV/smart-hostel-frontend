import { useEffect, useMemo, useState } from "react";
import { getStudentAlerts } from "../api/studentApi";
import StudentEmptyState from "../components/StudentEmptyState";
import StudentErrorState from "../components/StudentErrorState";
import StudentKpiCard from "../components/StudentKpiCard";
import StudentLoadingState from "../components/StudentLoadingState";
import StudentPageHeader from "../components/StudentPageHeader";
import StudentSectionCard from "../components/StudentSectionCard";
import { DEFAULT_STUDENT_ROOM_ID, STUDENT_PAGE_DESCRIPTIONS } from "../constants/studentConstants";
import { createStudentFilters } from "../models/studentModels";

export default function StudentAlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [filters, setFilters] = useState(createStudentFilters());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAlerts = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getStudentAlerts(DEFAULT_STUDENT_ROOM_ID, { limit: 100 });
      setAlerts(response.alerts);
    } catch (err) {
      setError(err?.message || "Failed to load student alerts.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  const filteredAlerts = useMemo(() => {
    return alerts.filter((alert) => {
      const matchesType = filters.alertType === "all" || alert.type === filters.alertType;
      const matchesSeverity = filters.severity === "all" || alert.severity === filters.severity;
      return matchesType && matchesSeverity;
    });
  }, [alerts, filters]);

  if (loading) {
    return <StudentLoadingState message="Loading personal alerts..." />;
  }

  if (error) {
    return <StudentErrorState message={error} onRetry={loadAlerts} />;
  }

  const criticalCount = filteredAlerts.filter((alert) => alert.severity === "Critical").length;

  return (
    <div className="student-page">
      <StudentPageHeader title="Personal Alerts" description={STUDENT_PAGE_DESCRIPTIONS.alerts} />

      <div className="student-kpi-grid">
        <StudentKpiCard title="Total Alerts" value={alerts.length} subtitle="Loaded from student alert API" />
        <StudentKpiCard title="Visible Alerts" value={filteredAlerts.length} subtitle="After current filters" />
        <StudentKpiCard title="Critical Alerts" value={criticalCount} subtitle="Current filtered set" />
        <StudentKpiCard title="Room Context" value={DEFAULT_STUDENT_ROOM_ID} subtitle="Temporary demo room config" />
      </div>

      <div className="student-section-grid">
        <StudentSectionCard
          title="Alert Filters"
          description="Basic filter-ready structure; advanced controls can be expanded in later phases."
        >
          <div className="student-filter-row">
            <label>
              Alert Type
              <select
                value={filters.alertType}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, alertType: event.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="energy">Energy</option>
                <option value="noise">Noise</option>
                <option value="general">General</option>
              </select>
            </label>

            <label>
              Severity
              <select
                value={filters.severity}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, severity: event.target.value }))
                }
              >
                <option value="all">All</option>
                <option value="Critical">Critical</option>
                <option value="Warning">Warning</option>
                <option value="Info">Info</option>
              </select>
            </label>
          </div>
        </StudentSectionCard>

        <StudentSectionCard title="Alerts List" description="Clean base list component for future table/card upgrades.">
          {filteredAlerts.length ? (
            <div className="student-alert-list">
              {filteredAlerts.map((alert) => (
                <article key={alert.id} className={`student-alert-item ${alert.severity.toLowerCase()}`}>
                  <div className="student-alert-top">
                    <strong>{alert.type.toUpperCase()}</strong>
                    <span>{alert.severity}</span>
                  </div>
                  <p>{alert.message}</p>
                  <small>{alert.timestamp || "Unknown time"}</small>
                </article>
              ))}
            </div>
          ) : (
            <StudentEmptyState title="No alerts match filters" message="Try broadening the selected filter options." />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Follow-up Placeholder"
          description="Reserved for acknowledgement workflows and alert lifecycle actions."
        >
          <p>Alert acknowledgement and escalation actions are intentionally deferred to Phase 2+.</p>
        </StudentSectionCard>
      </div>
    </div>
  );
}

