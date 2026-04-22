import { useEffect, useState } from "react";
import { getStudentAlerts } from "../api/studentApi";
import StudentEmptyState from "../components/StudentEmptyState";
import StudentErrorState from "../components/StudentErrorState";
import StudentKpiCard from "../components/StudentKpiCard";
import StudentLoadingState from "../components/StudentLoadingState";
import StudentPageHeader from "../components/StudentPageHeader";
import StudentSectionCard from "../components/StudentSectionCard";
import { DEFAULT_STUDENT_ROOM_ID, STUDENT_PAGE_DESCRIPTIONS } from "../constants/studentConstants";
import { mapAlertsToNoisePoints } from "../models/studentModels";

export default function StudentNoisePage() {
  const [noisePoints, setNoisePoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNoise = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await getStudentAlerts(DEFAULT_STUDENT_ROOM_ID, { limit: 50 });
      setNoisePoints(mapAlertsToNoisePoints(response.alerts));
    } catch (err) {
      setError(err?.message || "Failed to load noise monitoring data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadNoise();
  }, []);

  if (loading) {
    return <StudentLoadingState message="Loading noise monitoring data..." />;
  }

  if (error) {
    return <StudentErrorState message={error} onRetry={loadNoise} />;
  }

  const latestNoise = noisePoints[0];
  const criticalCount = noisePoints.filter((item) => item.noiseStatus === "Violation").length;
  const warningCount = noisePoints.filter((item) => item.noiseStatus === "Warning").length;

  return (
    <div className="student-page">
      <StudentPageHeader title="Noise Monitoring" description={STUDENT_PAGE_DESCRIPTIONS.noise} />

      <div className="student-kpi-grid">
        <StudentKpiCard title="Noise Records" value={noisePoints.length} subtitle="Based on recent alerts" />
        <StudentKpiCard title="Warning Events" value={warningCount} subtitle="Recent warning-level items" />
        <StudentKpiCard title="Violation Events" value={criticalCount} subtitle="Recent critical noise items" />
        <StudentKpiCard
          title="Latest Noise Status"
          value={latestNoise?.noiseStatus || "Normal"}
          subtitle="Most recent flagged reading"
        />
      </div>

      <div className="student-section-grid">
        <StudentSectionCard
          title="Noise Snapshot"
          description="Connected to alert data now, with room for a dedicated noise time-series endpoint later."
        >
          {noisePoints.length ? (
            <ul className="student-list">
              {noisePoints.slice(0, 8).map((point) => (
                <li key={`${point.timestamp}-${point.noiseStatus}`}>
                  {point.timestamp} | {point.noiseStatus} | Peak {point.soundPeak}
                </li>
              ))}
            </ul>
          ) : (
            <StudentEmptyState title="No noise incidents found" message="No warning or violation alerts were detected." />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Quiet Hour Compliance Placeholder"
          description="Reserved for compliance scoring and policy-level summaries."
        >
          <p>Compliance scoring is intentionally deferred to later phases.</p>
        </StudentSectionCard>

        <StudentSectionCard
          title="Incident Drilldown Placeholder"
          description="Reserved for detailed incident drilldowns and modal views."
        >
          <p>Drilldown interactions are deferred and not implemented in this phase.</p>
        </StudentSectionCard>
      </div>
    </div>
  );
}

