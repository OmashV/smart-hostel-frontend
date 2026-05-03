import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { getStudentAlerts, getStudentNoiseHistory, getStudentRecommendations } from "../api/studentApi";
import StudentAlertPreviewList from "../components/StudentAlertPreviewList";
import StudentEnergyFilterBar from "../components/StudentEnergyFilterBar";
import StudentEmptyState from "../components/StudentEmptyState";
import StudentErrorState from "../components/StudentErrorState";
import StudentKpiCard from "../components/StudentKpiCard";
import StudentLoadingState from "../components/StudentLoadingState";
import StudentPageHeader from "../components/StudentPageHeader";
import StudentRecommendationList from "../components/StudentRecommendationList";
import StudentSectionCard from "../components/StudentSectionCard";
import StudentStatusBadge from "../components/StudentStatusBadge";
import { DEFAULT_STUDENT_ROOM_ID } from "../constants/studentConstants";
import {
  buildNoiseInterpretation,
  buildPeakPeriodSummary,
  formatNoisePeak,
  formatNoiseTick,
  formatNoiseTooltipLabel,
  getNoiseStatusLabel
} from "../utils/noiseHelpers";
import { formatTimestamp } from "../utils/overviewHelpers";

const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid rgba(129, 140, 248, 0.45)",
  background: "rgba(255, 255, 255, 0.96)",
  boxShadow: "0 12px 26px rgba(30, 64, 175, 0.16)"
};

const CHART_TOOLTIP_LABEL_STYLE = {
  color: "#1e3a8a",
  fontWeight: 600
};

function getRequestErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load noise monitoring data."
  );
}

export default function StudentNoisePage() {
  const [filters, setFilters] = useState({ range: "7d", groupBy: "day" });
  const [refreshTick, setRefreshTick] = useState(0);

  const [noiseData, setNoiseData] = useState(null);
  const [noiseAlerts, setNoiseAlerts] = useState([]);
  const [recommendations, setRecommendations] = useState([]);
  const [partialErrors, setPartialErrors] = useState({});

  const [loading, setLoading] = useState(true);
  const [fatalError, setFatalError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPageData() {
      if (!cancelled) {
        setLoading(true);
        setFatalError("");
        setPartialErrors({});
      }

      const [historyRes, alertsRes, recommendationRes] = await Promise.allSettled([
        getStudentNoiseHistory(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range,
          groupBy: filters.groupBy
        }),
        getStudentAlerts(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range,
          type: "noise",
          limit: 10
        }),
        getStudentRecommendations(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range
        })
      ]);

      if (cancelled) return;

      if (historyRes.status !== "fulfilled") {
        setFatalError(getRequestErrorMessage(historyRes.reason));
        setNoiseData(null);
        setNoiseAlerts([]);
        setRecommendations([]);
        setLoading(false);
        return;
      }

      setNoiseData(historyRes.value);
      const nextPartialErrors = {};

      if (alertsRes.status === "fulfilled") {
        setNoiseAlerts(Array.isArray(alertsRes.value?.alerts) ? alertsRes.value.alerts : []);
      } else {
        setNoiseAlerts([]);
        nextPartialErrors.alerts = getRequestErrorMessage(alertsRes.reason);
      }

      if (recommendationRes.status === "fulfilled") {
        const items = Array.isArray(recommendationRes.value?.items) ? recommendationRes.value.items : [];
        setRecommendations(items);
      } else {
        setRecommendations([]);
        nextPartialErrors.recommendations = getRequestErrorMessage(recommendationRes.reason);
      }

      setPartialErrors(nextPartialErrors);
      setLoading(false);
    }

    loadPageData();

    return () => {
      cancelled = true;
    };
  }, [filters.groupBy, filters.range, refreshTick]);

  const points = useMemo(() => {
    return Array.isArray(noiseData?.points) ? noiseData.points : [];
  }, [noiseData]);

  const summary = useMemo(() => {
    return (
      noiseData?.summary || {
        averageNoisePeak: 0,
        noisyIntervals: 0,
        quietViolations: 0,
        peakNoiseValue: 0,
        peakNoiseAt: null
      }
    );
  }, [noiseData]);

  const hasHistory = points.length > 0;
  const roomId = noiseData?.roomId || DEFAULT_STUDENT_ROOM_ID;
  const latestPoint = hasHistory ? points[points.length - 1] : null;
  const latestStatus = getNoiseStatusLabel(latestPoint?.noiseStatus);
  const lastUpdated = latestPoint?.timestamp || null;

  const trendData = useMemo(
    () =>
      points.map((point) => ({
        timestamp: point.timestamp,
        soundPeak: Number(point.soundPeak || 0),
        noiseStatus: point.noiseStatus || "Normal"
      })),
    [points]
  );

  const peakPattern = useMemo(() => buildPeakPeriodSummary(points, filters.groupBy), [points, filters.groupBy]);
  const interpretationText = useMemo(
    () =>
      buildNoiseInterpretation({
        summary,
        latestPoint,
        alertCount: noiseAlerts.length
      }),
    [summary, latestPoint, noiseAlerts.length]
  );

  const recommendationItems = useMemo(() => {
    const prioritized = recommendations.filter((item) => {
      const category = String(item?.category || "").toLowerCase();
      return category === "noise" || category === "general";
    });

    return (prioritized.length ? prioritized : recommendations).slice(0, 4);
  }, [recommendations]);

  const rightMeta = (
    <p className="student-filter-summary">
      Range: {filters.range.toUpperCase()} | Group: {filters.groupBy}
    </p>
  );

  if (loading && !noiseData) {
    return <StudentLoadingState message="Loading noise monitoring data..." />;
  }

  if (fatalError && !noiseData) {
    return <StudentErrorState message={fatalError} onRetry={() => setRefreshTick((value) => value + 1)} />;
  }

  return (
    <div className="student-page student-page-noise">
      <StudentPageHeader
        title="Noise Monitoring"
        description="Track room noise patterns, peak periods, and quiet-hour behavior over time."
        roomId={roomId}
        lastUpdated={lastUpdated}
        rightSlot={rightMeta}
        kicker="Noise Intelligence"
      />

      <StudentEnergyFilterBar
        filters={filters}
        loading={loading}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onRefresh={() => setRefreshTick((value) => value + 1)}
      />

      <div className="student-kpi-grid">
        <StudentKpiCard
          title="Average Noise Peak"
          value={formatNoisePeak(summary.averageNoisePeak)}
          subtitle="Across selected range"
        />
        <StudentKpiCard
          title="Peak Noise"
          value={formatNoisePeak(summary.peakNoiseValue)}
          subtitle={summary.peakNoiseAt ? `at ${formatTimestamp(summary.peakNoiseAt)}` : "No peak timestamp available"}
        />
        <StudentKpiCard
          title="Noisy Intervals"
          value={summary.noisyIntervals ?? 0}
          subtitle="Intervals marked warning/critical"
        />
        <StudentKpiCard
          title="Quiet-Hour Violations"
          value={summary.quietViolations ?? 0}
          subtitle="Events during quiet hours"
        />
      </div>

      <div className="student-noise-primary-grid">
        <StudentSectionCard title="Noise Trend Over Time" description="Sound peak trend for the selected filters.">
          {hasHistory ? (
            <div className="student-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(value) => formatNoiseTick(value, filters.groupBy)} />
                  <YAxis />
                  <Tooltip
                    contentStyle={CHART_TOOLTIP_STYLE}
                    labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                    labelFormatter={(value) => formatNoiseTooltipLabel(value, filters.groupBy)}
                    formatter={(value, key, item) => {
                      if (key === "noiseStatus") return [String(value), "Status"];
                      return [`${Number(value).toFixed(1)} peak`, item?.name || "Noise Peak"];
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="soundPeak"
                    name="Noise Peak"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <StudentEmptyState
              title="No noise history"
              message="No noise history points were found for the selected filters."
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard title="Current Noise Interpretation" description="Latest condition with plain-language context.">
          <div className="student-noise-interpretation">
            <p className="student-noise-current">
              Current Status: <StudentStatusBadge value={latestStatus} />
            </p>
            <p>Latest Peak: {latestPoint ? formatNoisePeak(latestPoint.soundPeak) : "--"}</p>
            <p>Latest Interval: {latestPoint ? formatTimestamp(latestPoint.timestamp) : "--"}</p>
            <p className="student-muted-text">{interpretationText}</p>
          </div>
        </StudentSectionCard>
      </div>

      <div className="student-noise-lower-grid">
        <StudentSectionCard
          title="Peak Period Patterns"
          description="Highest noise intervals within the selected range."
        >
          {peakPattern.topPoints.length ? (
            <>
              <div className="student-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={peakPattern.topPoints}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => formatNoiseTick(value, filters.groupBy)} />
                    <YAxis />
                    <Tooltip
                      contentStyle={CHART_TOOLTIP_STYLE}
                      labelStyle={CHART_TOOLTIP_LABEL_STYLE}
                      labelFormatter={(value) => formatNoiseTooltipLabel(value, filters.groupBy)}
                      formatter={(value) => [`${Number(value).toFixed(1)} peak`, "Noise Peak"]}
                    />
                    <Legend />
                    <Bar dataKey="soundPeak" fill="#ec4899" name="Top Peaks" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="student-muted-text">{peakPattern.summaryText}</p>
            </>
          ) : (
            <StudentEmptyState
              title="No peak pattern available"
              message="Peak period analysis needs at least one noise history point."
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Recent Noise Alerts"
          description="A quick preview of recent noise-related alerts."
        >
          {partialErrors.alerts ? (
            <StudentEmptyState
              title="Noise alerts unavailable"
              message={partialErrors.alerts}
            />
          ) : (
            <StudentAlertPreviewList
              alerts={noiseAlerts.slice(0, 5)}
              maxItems={5}
              emptyTitle="No recent noise alerts"
              emptyMessage="No recent noise-related warning or critical events were found for this range."
            />
          )}
        </StudentSectionCard>
      </div>

      <StudentSectionCard
        title="Noise Recommendations"
        description="Actionable tips based on recent room behavior."
      >
        {partialErrors.recommendations ? (
          <StudentEmptyState
            title="Recommendations unavailable"
            message={partialErrors.recommendations}
          />
        ) : (
          <StudentRecommendationList items={recommendationItems} maxItems={4} />
        )}
      </StudentSectionCard>
    </div>
  );
}
