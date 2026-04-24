import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getStudentAlerts, getStudentAlertsSummary } from "../api/studentApi";
import StudentAlertDetailCard from "../components/StudentAlertDetailCard";
import StudentAlertsFilterBar from "../components/StudentAlertsFilterBar";
import StudentAlertsList from "../components/StudentAlertsList";
import StudentEmptyState from "../components/StudentEmptyState";
import StudentErrorState from "../components/StudentErrorState";
import StudentKpiCard from "../components/StudentKpiCard";
import StudentLoadingState from "../components/StudentLoadingState";
import StudentPageHeader from "../components/StudentPageHeader";
import StudentSectionCard from "../components/StudentSectionCard";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";
import {
  buildAlertPriorityGuidance,
  buildAlertsSummaryFallback,
  buildAlertTypeOptions,
  formatAlertPercentage,
  formatAlertTypeLabel,
  sortAlertsNewestFirst
} from "../utils/alertsHelpers";
import { toTitleCase } from "../utils/overviewHelpers";

const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid rgba(129, 140, 248, 0.45)",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 12px 26px rgba(30, 64, 175, 0.16)"
};

function getRequestErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load personal alerts."
  );
}

export default function StudentAlertsPage() {
  const [filters, setFilters] = useState({ range: "7d", type: "all", severity: "all" });
  const [refreshTick, setRefreshTick] = useState(0);

  const [summaryData, setSummaryData] = useState(null);
  const [alertsResponse, setAlertsResponse] = useState(null);
  const [partialErrors, setPartialErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");
  const [selectedAlertId, setSelectedAlertId] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadAlertsPage() {
      if (!cancelled) {
        setLoading(true);
        setFatalError("");
        setPartialErrors({});
      }

      const params = {
        range: filters.range,
        limit: 100
      };

      if (filters.type !== "all") {
        params.type = filters.type;
      }

      if (filters.severity !== "all") {
        params.severity = filters.severity;
      }

      const [summaryRes, alertsRes] = await Promise.allSettled([
        getStudentAlertsSummary(DEFAULT_STUDENT_ROOM_ID, params),
        getStudentAlerts(DEFAULT_STUDENT_ROOM_ID, params)
      ]);

      if (cancelled) return;

      const nextPartialErrors = {};
      const summaryFailed = summaryRes.status !== "fulfilled";
      const listFailed = alertsRes.status !== "fulfilled";

      if (summaryFailed && listFailed) {
        setSummaryData(null);
        setAlertsResponse(null);
        setFatalError(getRequestErrorMessage(alertsRes.reason || summaryRes.reason));
        setLoading(false);
        return;
      }

      if (summaryRes.status === "fulfilled") {
        setSummaryData(summaryRes.value);
      } else {
        setSummaryData(null);
        nextPartialErrors.summary = getRequestErrorMessage(summaryRes.reason);
      }

      if (alertsRes.status === "fulfilled") {
        setAlertsResponse(alertsRes.value);
      } else {
        setAlertsResponse(null);
        nextPartialErrors.list = getRequestErrorMessage(alertsRes.reason);
      }

      setPartialErrors(nextPartialErrors);
      setLoading(false);
    }

    loadAlertsPage();

    return () => {
      cancelled = true;
    };
  }, [filters.range, filters.severity, filters.type, refreshTick]);

  const alerts = useMemo(
    () => sortAlertsNewestFirst(Array.isArray(alertsResponse?.alerts) ? alertsResponse.alerts : []),
    [alertsResponse]
  );

  const effectiveSummary = useMemo(() => {
    if (summaryData) return summaryData;
    return buildAlertsSummaryFallback(alerts);
  }, [summaryData, alerts]);

  const typeOptions = useMemo(
    () => buildAlertTypeOptions(effectiveSummary?.byType || [], alerts),
    [effectiveSummary, alerts]
  );

  const selectedAlert = useMemo(
    () => alerts.find((item) => item.id === selectedAlertId) || alerts[0] || null,
    [alerts, selectedAlertId]
  );

  const breakdownItems = useMemo(
    () => (effectiveSummary?.byType || []).filter((item) => Number(item.count) > 0),
    [effectiveSummary]
  );

  const breakdownChartData = useMemo(
    () =>
      breakdownItems.map((item) => ({
        type: formatAlertTypeLabel(item.type),
        count: Number(item.count || 0)
      })),
    [breakdownItems]
  );

  const priorityGuidance = useMemo(
    () => buildAlertPriorityGuidance(effectiveSummary, alerts),
    [effectiveSummary, alerts]
  );

  const roomId = summaryData?.roomId || alertsResponse?.roomId || DEFAULT_STUDENT_ROOM_ID;
  const lastUpdated = alerts[0]?.timestamp || null;
  const hasAnyData = Boolean(summaryData || alertsResponse);
  const summarySourceText = summaryData
    ? "From alerts summary endpoint"
    : "Derived from currently loaded alert list";

  const rightMeta = (
    <p className="student-filter-summary">
      Range: {filters.range.toUpperCase()} | Type: {toTitleCase(filters.type)} | Severity:{" "}
      {toTitleCase(filters.severity)}
    </p>
  );

  if (loading && !hasAnyData) {
    return <StudentLoadingState message="Loading personal alerts..." />;
  }

  if (fatalError && !hasAnyData) {
    return <StudentErrorState message={fatalError} onRetry={() => setRefreshTick((value) => value + 1)} />;
  }

  return (
    <div className="student-page student-page-alerts">
      <StudentPageHeader
        title="Personal Alerts"
        description="Track your alert severity, filter incident types, and review details that need attention first."
        roomId={roomId}
        lastUpdated={lastUpdated}
        rightSlot={rightMeta}
        kicker="Alert Center"
      />

      <StudentAlertsFilterBar
        filters={filters}
        loading={loading}
        typeOptions={typeOptions}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onRefresh={() => setRefreshTick((value) => value + 1)}
      />

      <div className="student-kpi-grid">
        <StudentKpiCard
          title="Total Alerts"
          value={effectiveSummary.total ?? 0}
          subtitle={summarySourceText}
        />
        <StudentKpiCard
          title="Active Alerts"
          value={effectiveSummary.active ?? 0}
          subtitle="Open alerts requiring review"
        />
        <StudentKpiCard
          title="Critical Alerts"
          value={effectiveSummary.critical ?? 0}
          subtitle={summarySourceText}
        />
        <StudentKpiCard
          title="Warning Alerts"
          value={effectiveSummary.warning ?? 0}
          subtitle={summarySourceText}
        />
      </div>

      <div className="student-alerts-top-grid">
        <StudentSectionCard
          title="Alert Type Breakdown"
          description="Distribution of alerts by type for the selected filters."
        >
          {breakdownItems.length ? (
            <>
              <div className="student-chart-wrap">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={breakdownChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="type" />
                    <YAxis allowDecimals={false} />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      formatter={(value) => [Number(value), "Alerts"]}
                    />
                    <Bar dataKey="count" fill="#7c3aed" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="student-alert-breakdown-list">
                {breakdownItems.map((item) => (
                  <div key={item.type} className="student-alert-breakdown-item">
                    <span>{formatAlertTypeLabel(item.type)}</span>
                    <strong>
                      {item.count} ({formatAlertPercentage(item.count, effectiveSummary.total)})
                    </strong>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <StudentEmptyState
              title="No type breakdown available"
              message={
                partialErrors.summary || "No type-level alert distribution was returned for the selected filters."
              }
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Priority Guidance"
          description="Quick triage suggestions based on current alert severity and type distribution."
        >
          <p className="student-alert-guidance-title">{priorityGuidance.title}</p>
          <p className="student-muted-text">{priorityGuidance.message}</p>
          <p className="student-muted-text">
            Critical share: {formatAlertPercentage(effectiveSummary.critical, effectiveSummary.total)} | Warning
            share: {formatAlertPercentage(effectiveSummary.warning, effectiveSummary.total)}
          </p>
        </StudentSectionCard>
      </div>

      <div className="student-alerts-main-grid">
        <StudentSectionCard
          title="Alert List"
          description="Recent alerts are shown first. Select any item to inspect details."
        >
          {partialErrors.list ? (
            <StudentErrorState
              message={partialErrors.list}
              onRetry={() => setRefreshTick((value) => value + 1)}
            />
          ) : (
            <StudentAlertsList
              alerts={alerts}
              selectedAlertId={selectedAlert?.id}
              onSelect={(alert) => setSelectedAlertId(alert.id)}
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Alert Details"
          description="Lightweight detail panel for the currently selected alert."
        >
          {partialErrors.list && !alerts.length ? (
            <StudentEmptyState
              title="Details unavailable"
              message="Alert details will appear once the alert list is available."
            />
          ) : (
            <StudentAlertDetailCard alert={selectedAlert} />
          )}
        </StudentSectionCard>
      </div>
    </div>
  );
}
