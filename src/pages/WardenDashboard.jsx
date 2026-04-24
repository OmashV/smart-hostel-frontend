import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineSpeakerWave,
  HiOutlineWrenchScrewdriver
} from "react-icons/hi2";
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
  getAvailableRooms,
  getWardenAnomalies,
  getWardenDataRange,
  getWardenForecasts,
  getWardenHistory,
  getWardenMlAlerts,
  getWardenPatterns,
  getWardenRoomsStatus,
  getWardenSummary
} from "../api/client";
import ChatAssistant from "../components/ChatAssistant";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { formatDate } from "../utils/format";

const ORDERED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: "12px",
  color: "#172033",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
};

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(digits) : "0.00";
}

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

function historyTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("critical") || text.includes("high") || text.includes("abnormal") || text.includes("alert")) return "danger";
  if (text.includes("warning") || text.includes("moderate") || text.includes("inspection")) return "warning";
  if (text.includes("normal") || text.includes("valid")) return "ok";
  return "neutral";
}

function HistoryWord({ value }) {
  return <span className={`history-word ${historyTone(value)}`}>{valueOrDash(value)}</span>;
}

function renderForecastLegend({ payload = [] }) {
  return (
    <div className="owner-legend-row">
      {payload.map((entry) => {
        const isPredicted = String(entry.value || "").toLowerCase().includes("predicted");
        return (
          <span key={entry.value} className="owner-legend-item">
            <span
              className={`legend-line ${isPredicted ? "predicted" : "actual"}`}
              style={{ borderColor: entry.color || "#2563eb" }}
            />
            <span className={`legend-label ${isPredicted ? "predicted" : "actual"}`}>
              {entry.value}
            </span>
          </span>
        );
      })}
    </div>
  );
}

function WardenAlertCard({ alert }) {
  const severity = alert.severity || "Info";
  const icon = severity === "Critical" ? <HiOutlineExclamationTriangle size={18} /> : <HiOutlineBellAlert size={18} />;

  return (
    <div className={`warden-alert-button alert-card ${severity === "Critical" ? "critical" : severity === "Warning" ? "warning" : "info"}`}>
      <div className="alert-card-head">
        <div className="alert-card-title">
          {icon}
          <strong>{alert.alert_type || "ML Alert"}</strong>
        </div>
        <StatusBadge value={severity} />
      </div>
      <p className="alert-card-message">{alert.reason || "Generated from Warden ML alert model."}</p>
      <div className="alert-card-foot">
        <span>{valueOrDash(alert.room_id)}</span>
        <span>{alert.confidence !== undefined ? `${Math.round(Number(alert.confidence || 0) * 100)}% confidence` : "ML confidence"}</span>
      </div>
      <div className="alert-card-foot">
        <span>{alert.model_name || "IsolationForest"}</span>
        <span>{alert.captured_at ? formatDate(alert.captured_at) : "No Date"}</span>
      </div>
    </div>
  );
}

function WardenRoomTile({ room }) {
  return (
    <div className={`owner-room-tile ${room.needs_inspection ? "warning" : "normal"} warden-room-tile`}>
      <div className="tile-top">
        <div>
          <h3>{valueOrDash(room.room_id)}</h3>
          <p className="tile-subtext">Room monitoring</p>
        </div>
        <span className={`tile-dot ${room.needs_inspection ? "orange" : "green"}`} />
      </div>
      <div className="tile-metrics">
        <div className="tile-row"><span>Occupancy</span><strong>{valueOrDash(room.occupancy_stat)}</strong></div>
        <div className="tile-row"><span>Noise</span><strong>{valueOrDash(room.noise_stat)}</strong></div>
        <div className="tile-row"><span>Door</span><strong>{valueOrDash(room.door_status)}</strong></div>
        <div className="tile-row"><span>Inspection</span><strong>{room.needs_inspection ? "Yes" : "No"}</strong></div>
      </div>
      <div className="tile-badges">
        <StatusBadge value={room.occupancy_stat || "Unknown"} />
        <StatusBadge value={room.noise_stat || "Unknown"} />
        <StatusBadge value={room.door_status || "Unknown"} />
      </div>
    </div>
  );
}

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [roomId, setRoomId] = useState("All");
  const [roomOptions, setRoomOptions] = useState(["All"]);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [mlAlerts, setMlAlerts] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [forecasts, setForecasts] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [history, setHistory] = useState([]);
  const [dataRange, setDataRange] = useState(null);
  const roomIdRef = useRef(roomId);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    async function loadOptions() {
      try {
        const res = await getAvailableRooms("All");
        setRoomOptions(["All", ...(res?.rooms || [])]);
      } catch (_) {
        setRoomOptions(["All"]);
      }
    }
    loadOptions();
  }, []);

  async function fetchAllData() {
    try {
      setError("");
      
      const [
        summaryRes,
        roomsRes,
        alertsRes,
        patternsRes,
        forecastsRes,
        anomaliesRes,
        historyRes,
        dataRangeRes
      ] = await Promise.all([
        getWardenSummary(roomId),
        getWardenRoomsStatus(roomId),
        getWardenMlAlerts(roomId),
        getWardenPatterns(roomId),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenHistory(roomId),
        getWardenDataRange(roomId)
      ]);

      setSummary(summaryRes || null);
      setRooms(roomsRes?.rooms || []);
      setMlAlerts(alertsRes?.items || []);
      setPatterns(patternsRes?.items || []);
      setForecasts(forecastsRes?.items || []);
      setAnomalies(anomaliesRes?.items || []);
      setHistory(historyRes?.items || historyRes?.history || []);
      setDataRange(dataRangeRes || null);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load Warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 8000);
    return () => clearInterval(interval);
  }, [roomId]);

  const patternsByDay = useMemo(() => {
    const map = new Map((patterns || []).map((item) => [item.day, item]));
    return ORDERED_DAYS.map((day) => {
      return map.get(day) || {
        day,
        day_type: ["Saturday", "Sunday"].includes(day) ? "Weekend" : "Weekday",
        usual_pattern: "No Data",
        avg_occupancy: 0,
        avg_noise_level: 0,
        avg_warnings: 0,
        avg_critical_ratio: 0,
        cluster_id: -1
      };
    });
  }, [patterns]);

  const forecastChartData = useMemo(() => {
    const actualRows = (history || []).map((item) => ({
      date: item.date,
      actual_occupancy: Number(item.occupied_count || 0),
      actual_warnings: Number(item.warning_count || 0),
      predicted_occupancy: null,
      predicted_warnings: null
    }));

    const predictedRows = (forecasts || []).map((item) => ({
      date: item.date,
      actual_occupancy: null,
      actual_warnings: null,
      predicted_occupancy: Number(item.predicted_occupied_count || 0),
      predicted_warnings: Number(item.predicted_warning_count || 0)
    }));

    return [...actualRows, ...predictedRows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }, [history, forecasts]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <div className="filter-bar warden-filter-bar">
        <label>
          Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {roomOptions.map((id) => <option key={id} value={id}>{id}</option>)}
          </select>
        </label>
      </div>

      {error ? <div className="warden-error-box"><strong>Dashboard error:</strong> {error}</div> : null}

      <div className="stats-grid">
        <StatCard title="Occupied Rooms" value={summary?.occupied_rooms ?? 0} subtitle="From Warden summary API" icon={<HiOutlineHomeModern />} tone="blue" />
        <StatCard title="Empty Rooms" value={summary?.empty_rooms ?? 0} subtitle="Available for cleaning" icon={<HiOutlineHomeModern />} tone="green" />
        <StatCard title="ML Alerts" value={mlAlerts.length} subtitle="From IsolationForest alerts" icon={<HiOutlineSpeakerWave />} tone="orange" />
        <StatCard title="Data Days" value={formatNumber(dataRange?.total_days_covered || 0, 1)} subtitle={dataRange?.is_valid_5_to_7_days_or_more ? "Valid 5–7+ days" : "Data range check"} icon={<HiOutlineWrenchScrewdriver />} tone="red" />
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Room Monitoring">
          {rooms.length ? (
            <div className="owner-room-grid">
              {rooms.map((room) => <WardenRoomTile key={room.room_id} room={room} />)}
            </div>
          ) : <EmptyState text="No room status records available." />}
        </SectionCard>

        <SectionCard title="Active Alerts">
          {mlAlerts.length ? (
            <div className="alerts-list">
              {mlAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-${index}`} alert={alert} />)}
            </div>
          ) : <EmptyState text="No ML alerts available." />}
        </SectionCard>
      </div>

      <div className="owner-top-grid">
        <SectionCard title="Historical and Forecasted Room Trend">
          {forecastChartData.length ? (
            <div className="chart-shell owner-forecast-chart-shell">
              <ResponsiveContainer width="100%" height={360}>
                <LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 6, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} minTickGap={18} />
                  <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} allowDecimals={false} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend content={renderForecastLegend} />
                  <Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" stroke="#2563eb" strokeDasharray="5 5" strokeWidth={2.5} dot={false} connectNulls />
                  <Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2.5} dot={false} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState text="No forecast or history data available." />}
        </SectionCard>

        <SectionCard title="7-Day Warden History">
          {history.length ? (
            <div className="chart-shell">
              <ResponsiveContainer width="100%" height={360}>
                <BarChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                  <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fill: "#64748b", fontSize: 11 }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Bar dataKey="occupied_count" name="Occupied" fill="#2563eb" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="warning_count" name="Warnings" fill="#f59e0b" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState text="No 7-day history data available." />}
        </SectionCard>
      </div>

      <SectionCard title="Weekly Pattern Discovery">
        {patternsByDay.length ? (
          <DataTable
            columns={[
              { key: "day", label: "Day" },
              { key: "day_type", label: "Type" },
              { key: "usual_pattern", label: "Usual Pattern", render: (row) => <HistoryWord value={row.usual_pattern} /> },
              { key: "avg_occupancy", label: "Avg Occupancy", render: (row) => formatNumber(row.avg_occupancy) },
              { key: "avg_noise_level", label: "Avg Noise Level", render: (row) => formatNumber(row.avg_noise_level) },
              { key: "avg_warnings", label: "Avg Warnings", render: (row) => formatNumber(row.avg_warnings) },
              { key: "avg_critical_ratio", label: "Avg Critical Ratio", render: (row) => `${formatNumber(row.avg_critical_ratio)}%` },
              { key: "cluster_id", label: "Cluster" }
            ]}
            rows={patternsByDay}
          />
        ) : <EmptyState text="No weekly pattern records available." />}
      </SectionCard>

      <SectionCard title="Abnormal / Anomaly Records">
        {anomalies.length ? (
          <DataTable
            columns={[
              { key: "room_id", label: "Room" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status", render: (row) => <HistoryWord value={row.status || "Abnormal"} /> },
              { key: "anomaly_score", label: "Score", render: (row) => formatNumber(row.anomaly_score, 3) },
              { key: "reason", label: "Reason" }
            ]}
            rows={anomalies.slice(0, 12)}
          />
        ) : <EmptyState text="No anomaly records available." />}
      </SectionCard>

      <SectionCard title="Data Range Proof">
        {dataRange ? (
          <div className="warden-data-range-grid">
            <HistoryWord value={`Days covered: ${formatNumber(dataRange.total_days_covered, 2)}`} />
            <HistoryWord value={dataRange.is_valid_5_to_7_days_or_more ? "Valid 5–7+ days" : "Not enough days"} />
            <span>First: {dataRange.first_timestamp ? formatDate(dataRange.first_timestamp) : "No Data"}</span>
            <span>Last: {dataRange.last_timestamp ? formatDate(dataRange.last_timestamp) : "No Data"}</span>
          </div>
        ) : <EmptyState text="No data range proof available." />}
      </SectionCard>

      <ChatAssistant roomId={roomId} />
    </div>
  );
}
