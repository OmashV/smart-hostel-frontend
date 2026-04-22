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
import {
  getStudentEnergyComparison,
  getStudentEnergyForecast,
  getStudentEnergyHistory,
  getStudentRecommendations
} from "../api/studentApi";
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
  buildComparisonBars,
  buildEnergyInsights,
  buildForecastSummary,
  formatEnergyTick,
  formatEnergyTooltipLabel,
  getWasteLevel
} from "../utils/energyHelpers";
import { formatKwh, formatTimestamp } from "../utils/overviewHelpers";

function getRequestErrorMessage(error) {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    "Failed to load energy dashboard data."
  );
}

export default function StudentEnergyPage() {
  const [filters, setFilters] = useState({ range: "7d", groupBy: "day" });
  const [refreshTick, setRefreshTick] = useState(0);

  const [historyData, setHistoryData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);
  const [forecastData, setForecastData] = useState(null);
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

      const [historyRes, comparisonRes, forecastRes, recommendationRes] = await Promise.allSettled([
        getStudentEnergyHistory(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range,
          groupBy: filters.groupBy
        }),
        getStudentEnergyComparison(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range
        }),
        getStudentEnergyForecast(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range,
          groupBy: filters.groupBy
        }),
        getStudentRecommendations(DEFAULT_STUDENT_ROOM_ID, {
          range: filters.range
        })
      ]);

      if (cancelled) return;

      if (historyRes.status !== "fulfilled") {
        setFatalError(getRequestErrorMessage(historyRes.reason));
        setHistoryData(null);
        setComparisonData(null);
        setForecastData(null);
        setRecommendations([]);
        setLoading(false);
        return;
      }

      setHistoryData(historyRes.value);
      const nextPartialErrors = {};

      if (comparisonRes.status === "fulfilled") {
        setComparisonData(comparisonRes.value);
      } else {
        setComparisonData(null);
        nextPartialErrors.comparison = getRequestErrorMessage(comparisonRes.reason);
      }

      if (forecastRes.status === "fulfilled") {
        setForecastData(forecastRes.value);
      } else {
        setForecastData(null);
        nextPartialErrors.forecast = getRequestErrorMessage(forecastRes.reason);
      }

      if (recommendationRes.status === "fulfilled") {
        setRecommendations(Array.isArray(recommendationRes.value?.items) ? recommendationRes.value.items : []);
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
    return Array.isArray(historyData?.points) ? historyData.points : [];
  }, [historyData]);

  const summary = historyData?.summary || {
    totalEnergy: 0,
    totalWastedEnergy: 0,
    averageDailyEnergy: 0,
    peakUsageValue: 0,
    peakUsageAt: null
  };

  const hasHistory = points.length > 0;
  const roomId = historyData?.roomId || DEFAULT_STUDENT_ROOM_ID;
  const lastUpdated = points[points.length - 1]?.timestamp || null;
  const wasteLevel = getWasteLevel(summary.totalEnergy, summary.totalWastedEnergy);

  const historyChartData = useMemo(
    () =>
      points.map((point) => ({
        timestamp: point.timestamp,
        totalEnergy: Number(point.energyKwh || 0),
        wastedEnergy: Number(point.wastedEnergyKwh || 0)
      })),
    [points]
  );

  const forecastChartData = useMemo(() => {
    const historical = Array.isArray(forecastData?.historicalPoints) ? forecastData.historicalPoints : [];
    const forecast = Array.isArray(forecastData?.forecastPoints) ? forecastData.forecastPoints : [];

    return [
      ...historical.map((point) => ({
        timestamp: point.timestamp,
        historicalEnergy: Number(point.energyKwh || 0),
        forecastEnergy: null
      })),
      ...forecast.map((point) => ({
        timestamp: point.timestamp,
        historicalEnergy: null,
        forecastEnergy: Number(point.energyKwh || 0)
      }))
    ];
  }, [forecastData]);

  const comparisonBars = useMemo(() => buildComparisonBars(comparisonData), [comparisonData]);

  const insights = useMemo(
    () =>
      buildEnergyInsights({
        history: historyData,
        comparison: comparisonData,
        forecast: forecastData
      }),
    [historyData, comparisonData, forecastData]
  );

  const recommendationItems = useMemo(() => {
    const energyFirst = recommendations.filter((item) =>
      ["energy", "general", "alerts"].includes((item.category || "").toLowerCase())
    );
    return (energyFirst.length ? energyFirst : recommendations).slice(0, 4);
  }, [recommendations]);

  const rightMeta = (
    <p className="student-filter-summary">
      Range: {filters.range.toUpperCase()} | Group: {filters.groupBy}
    </p>
  );

  if (loading && !historyData) {
    return <StudentLoadingState message="Loading energy history..." />;
  }

  if (fatalError && !historyData) {
    return <StudentErrorState message={fatalError} onRetry={() => setRefreshTick((value) => value + 1)} />;
  }

  return (
    <div className="student-page">
      <StudentPageHeader
        title="Energy Usage"
        description="Understand your room's energy trend, waste behavior, and short-term usage estimates."
        roomId={roomId}
        lastUpdated={lastUpdated}
        rightSlot={rightMeta}
      />

      <StudentEnergyFilterBar
        filters={filters}
        loading={loading}
        onChange={(next) => setFilters((prev) => ({ ...prev, ...next }))}
        onRefresh={() => setRefreshTick((value) => value + 1)}
      />

      <div className="student-kpi-grid">
        <StudentKpiCard title="Total Energy" value={formatKwh(summary.totalEnergy)} subtitle="Across selected range" />
        <StudentKpiCard
          title="Total Wasted Energy"
          value={formatKwh(summary.totalWastedEnergy)}
          subtitle="Potentially avoidable usage"
        />
        <StudentKpiCard
          title="Average Usage"
          value={formatKwh(summary.averageDailyEnergy)}
          subtitle="Average per selected group"
        />
        <StudentKpiCard
          title="Peak Usage"
          value={formatKwh(summary.peakUsageValue)}
          subtitle={summary.peakUsageAt ? `at ${formatTimestamp(summary.peakUsageAt)}` : "No peak timestamp available"}
        />
      </div>

      <div className="student-energy-primary-grid">
        <StudentSectionCard
          title="Historical Energy Trend"
          description="Total energy usage over time for the selected filters."
        >
          {hasHistory ? (
            <div className="student-chart-wrap">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={historyChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="timestamp" tickFormatter={(value) => formatEnergyTick(value, filters.groupBy)} />
                  <YAxis unit=" kWh" />
                  <Tooltip
                    labelFormatter={(value) => formatEnergyTooltipLabel(value, filters.groupBy)}
                    formatter={(value) => [`${Number(value).toFixed(2)} kWh`, "Total Energy"]}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="totalEnergy"
                    name="Total Energy"
                    stroke="#2563eb"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <StudentEmptyState
              title="No energy history"
              message="No historical energy readings were found for the selected filters."
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Wasted Energy Trend"
          description="Wasted energy isolated for easier waste-pattern reading."
        >
          {hasHistory ? (
            <>
              <div className="student-chart-wrap">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={historyChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => formatEnergyTick(value, filters.groupBy)} />
                    <YAxis unit=" kWh" />
                    <Tooltip
                      labelFormatter={(value) => formatEnergyTooltipLabel(value, filters.groupBy)}
                      formatter={(value) => [`${Number(value).toFixed(2)} kWh`, "Wasted Energy"]}
                    />
                    <Legend />
                    <Bar dataKey="wastedEnergy" name="Wasted Energy" fill="#f97316" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="student-energy-note">
                <StudentStatusBadge value={wasteLevel.label} />
                <p>{wasteLevel.message}</p>
              </div>
            </>
          ) : (
            <StudentEmptyState
              title="No waste trend available"
              message="Wasted energy visualization requires historical points."
            />
          )}
        </StudentSectionCard>
      </div>

      <div className="student-section-grid">
        <StudentSectionCard
          title="Energy Comparison"
          description="How your room average compares with peer and hostel averages."
        >
          {comparisonData ? (
            <>
              <div className="student-comparison-grid">
                <div className="student-compare-item">
                  <small>Your Room</small>
                  <strong>{formatKwh(comparisonData.roomAverage)}</strong>
                </div>
                <div className="student-compare-item">
                  <small>Peer Average</small>
                  <strong>
                    {comparisonData.peerAverage === null || comparisonData.peerAverage === undefined
                      ? "--"
                      : formatKwh(comparisonData.peerAverage)}
                  </strong>
                </div>
                <div className="student-compare-item">
                  <small>Hostel Average</small>
                  <strong>{formatKwh(comparisonData.hostelAverage)}</strong>
                </div>
              </div>

              {comparisonBars.length >= 2 ? (
                <div className="student-chart-wrap">
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={comparisonBars}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis unit=" kWh" />
                      <Tooltip formatter={(value) => [`${Number(value).toFixed(2)} kWh`, "Average"]} />
                      <Bar dataKey="value" fill="#0ea5e9" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : null}

              <p className="student-muted-text">
                {comparisonData.interpretation || "Comparison interpretation is unavailable for this window."}
              </p>
            </>
          ) : (
            <StudentEmptyState
              title="Comparison unavailable"
              message={partialErrors.comparison || "Comparison data could not be loaded for this filter range."}
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Short-Term Forecast Preview"
          description={buildForecastSummary(forecastData)}
        >
          {forecastData && forecastChartData.length ? (
            <>
              <div className="student-chart-wrap">
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={forecastChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="timestamp" tickFormatter={(value) => formatEnergyTick(value, filters.groupBy)} />
                    <YAxis unit=" kWh" />
                    <Tooltip
                      labelFormatter={(value) => formatEnergyTooltipLabel(value, filters.groupBy)}
                      formatter={(value, name) => [
                        `${Number(value).toFixed(2)} kWh`,
                        name === "historicalEnergy" ? "Historical" : "Forecast"
                      ]}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="historicalEnergy"
                      name="Historical"
                      stroke="#1d4ed8"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="forecastEnergy"
                      name="Forecast"
                      stroke="#f97316"
                      strokeWidth={2}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="student-muted-text">
                Confidence:{" "}
                {Number.isFinite(Number(forecastData?.confidence?.score))
                  ? `${Math.round(Number(forecastData.confidence.score) * 100)}%`
                  : "--"}{" "}
                ({forecastData?.confidence?.method || "preview method"})
              </p>
            </>
          ) : (
            <StudentEmptyState
              title="Forecast unavailable"
              message={partialErrors.forecast || "Forecast preview could not be loaded for this filter range."}
            />
          )}
        </StudentSectionCard>
      </div>

      <div className="student-energy-insight-grid">
        <StudentSectionCard
          title="Energy Insights"
          description="Simple plain-language insights from your current energy dataset."
        >
          {insights.length ? (
            <ul className="student-list">
              {insights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : (
            <StudentEmptyState
              title="No additional insights"
              message="Insights will appear once enough energy points are available."
            />
          )}
        </StudentSectionCard>

        <StudentSectionCard
          title="Recommended Actions"
          description="Rule-based tips from backend recommendations for this room."
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
    </div>
  );
}

