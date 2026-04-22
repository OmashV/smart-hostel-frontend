import { useEffect, useState } from "react";
import { getStudentOverview, getStudentRecommendations } from "../api/studentApi";
import StudentAlertPreviewList from "../components/StudentAlertPreviewList";
import StudentEmptyState from "../components/StudentEmptyState";
import StudentErrorState from "../components/StudentErrorState";
import StudentInsightCard from "../components/StudentInsightCard";
import StudentKpiCard from "../components/StudentKpiCard";
import StudentLoadingState from "../components/StudentLoadingState";
import StudentPageHeader from "../components/StudentPageHeader";
import StudentRecommendationList from "../components/StudentRecommendationList";
import StudentSectionCard from "../components/StudentSectionCard";
import StudentStatusBadge from "../components/StudentStatusBadge";
import StudentStatusCard from "../components/StudentStatusCard";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";
import { buildOverviewInsight, formatKwh } from "../utils/overviewHelpers";

function getRequestErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load student overview."
  );
}

function normalizeRecommendationItem(item, index) {
  if (typeof item === "string") {
    return {
      id: `tip-${index}`,
      title: "Suggested Tip",
      message: item,
      priority: "low",
      category: "general"
    };
  }

  return {
    id: item?.id || `tip-${index}`,
    title: item?.title || "Suggested Tip",
    message: item?.message || "Keep monitoring your room usage trends.",
    priority: item?.priority || "low",
    category: item?.category || "general"
  };
}

export default function StudentOverviewPage() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadOverview = async () => {
    setLoading(true);
    setError("");

    try {
      const overviewRes = await getStudentOverview(DEFAULT_STUDENT_ROOM_ID, { limit: 5, range: "24h" });
      const needsRecommendationFetch =
        !Array.isArray(overviewRes?.recommendations) || overviewRes.recommendations.length === 0;

      let recommendations = overviewRes?.recommendations || [];
      if (needsRecommendationFetch) {
        const recommendationRes = await getStudentRecommendations(DEFAULT_STUDENT_ROOM_ID, { range: "7d" });
        recommendations = Array.isArray(recommendationRes?.items) ? recommendationRes.items : [];
      }

      setOverview({
        ...overviewRes,
        recommendations
      });
    } catch (err) {
      setError(getRequestErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  if (loading) {
    return <StudentLoadingState message="Loading student overview..." />;
  }

  if (error) {
    return <StudentErrorState message={error} onRetry={loadOverview} />;
  }

  if (!overview) {
    return (
      <StudentEmptyState
        title="Overview unavailable"
        message="No overview data could be loaded for this room yet."
      />
    );
  }

  const roomId = overview.roomId || DEFAULT_STUDENT_ROOM_ID;
  const roomStatus = overview.roomStatus || {};
  const latestUpdatedAt = roomStatus.updatedAt || overview.latestReading?.updatedAt || overview.latestReading?.timestamp;
  const recentAlerts = Array.isArray(overview.recentAlerts) ? overview.recentAlerts : [];
  const recommendations = Array.isArray(overview.recommendations)
    ? overview.recommendations.map((item, index) => normalizeRecommendationItem(item, index))
    : [];
  const activeAlerts = overview.kpis?.activeAlerts ?? recentAlerts.length;
  const hasStatusValue = ["occupancy", "noiseStatus", "wasteStatus", "doorStatus", "currentAmp", "updatedAt"].some(
    (key) => roomStatus?.[key] !== undefined && roomStatus?.[key] !== null && roomStatus?.[key] !== ""
  );
  const hasEnergyValue =
    overview?.kpis &&
    (Object.prototype.hasOwnProperty.call(overview.kpis, "todayEnergyKwh") ||
      Object.prototype.hasOwnProperty.call(overview.kpis, "todayWastedEnergyKwh"));
  const hasUsableData = hasStatusValue || hasEnergyValue || recentAlerts.length > 0 || recommendations.length > 0;
  const insightMessage = buildOverviewInsight({
    kpis: overview.kpis,
    roomStatus,
    recentAlerts
  });

  if (!hasUsableData) {
    return (
      <StudentEmptyState
        title="No overview data available"
        message="We could not find usable summary data for your room in the selected period."
      />
    );
  }

  return (
    <div className="student-page">
      <StudentPageHeader
        title="My Usage Overview"
        description="Track your room's current conditions, daily energy usage, and actions to improve efficiency."
        roomId={roomId}
        lastUpdated={latestUpdatedAt}
      />

      <div className="student-kpi-grid">
        <StudentKpiCard
          title="Energy Used Today"
          value={formatKwh(overview?.kpis?.todayEnergyKwh)}
          subtitle="Total measured room energy today"
        />
        <StudentKpiCard
          title="Wasted Energy Today"
          value={formatKwh(overview?.kpis?.todayWastedEnergyKwh)}
          subtitle="Potentially avoidable energy usage"
        />
        <StudentKpiCard
          title="Current Noise Status"
          value={<StudentStatusBadge value={overview?.kpis?.currentNoiseStatus || roomStatus?.noiseStatus} />}
          subtitle="Latest room noise condition"
        />
        <StudentKpiCard
          title="Active Alerts"
          value={activeAlerts}
          subtitle="Alerts requiring attention"
        />
      </div>

      <div className="student-overview-upper-grid">
        <StudentSectionCard
          title="Current Room Status"
          description="Latest room telemetry snapshot from the backend."
        >
          <StudentStatusCard status={roomStatus} />
        </StudentSectionCard>

        <StudentSectionCard
          title="Quick Insight Summary"
          description="A plain-language summary of your current room condition."
        >
          <StudentInsightCard message={insightMessage} />
        </StudentSectionCard>
      </div>

      <div className="student-overview-lower-grid">
        <StudentSectionCard
          title="Recent Alerts"
          description="Most recent room alerts with quick access to the full alerts page."
        >
          <StudentAlertPreviewList alerts={recentAlerts} maxItems={5} />
        </StudentSectionCard>

        <StudentSectionCard
          title="Recommendations"
          description="Personalized rule-based actions generated from your recent room activity."
        >
          <StudentRecommendationList items={recommendations} maxItems={4} />
        </StudentSectionCard>
      </div>
    </div>
  );
}
