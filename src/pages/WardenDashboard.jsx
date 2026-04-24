import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  Bar,
  BarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getSummary,
  getRoomsStatus,
  getAlerts,
  getAnomalies,
  getPatterns,
  getForecasts,
  getHistory,
  getDataRange
} from "../api/client";
import ChatAssistant from "../components/ChatAssistant";

const ORDERED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function formatNumber(value, digits = 2) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number.toFixed(digits) : "0.00";
}

function valueOrDash(value) {
  return value === undefined || value === null || value === "" ? "-" : value;
}

export default function WardenDashboard() {
  const [roomId, setRoomId] = useState("All");
  const [summary, setSummary] = useState(null);
  const [roomsData, setRoomsData] = useState({ rooms: [] });
  const [alertsData, setAlertsData] = useState({ items: [] });
  const [anomaliesData, setAnomaliesData] = useState({ items: [] });
  const [patternsData, setPatternsData] = useState({ items: [] });
  const [forecastsData, setForecastsData] = useState({ items: [] });
  const [historyData, setHistoryData] = useState({ items: [] });
  const [dataRange, setDataRange] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [
        summaryRes,
        roomsRes,
        alertsRes,
        anomaliesRes,
        patternsRes,
        forecastsRes,
        historyRes,
        dataRangeRes
      ] = await Promise.all([
        getSummary(roomId),
        getRoomsStatus(roomId),
        getAlerts(roomId),
        getAnomalies(roomId),
        getPatterns(roomId),
        getForecasts(roomId),
        getHistory(roomId),
        getDataRange(roomId)
      ]);

      setSummary(summaryRes);
      setRoomsData(roomsRes || { rooms: [] });
      setAlertsData(alertsRes || { items: [] });
      setAnomaliesData(anomaliesRes || { items: [] });
      setPatternsData(patternsRes || { items: [] });
      setForecastsData(forecastsRes || { items: [] });
      setHistoryData(historyRes || { items: [] });
      setDataRange(dataRangeRes);
    } catch (err) {
      setError(err?.message || "Failed to load Warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [roomId]);

  const rooms = roomsData.rooms || [];
  const alerts = alertsData.items || [];
  const anomalies = anomaliesData.items || [];
  const forecasts = forecastsData.items || [];
  const history = historyData.items || historyData.history || [];
  const patternsByDay = useMemo(() => {
    const map = new Map((patternsData.items || []).map((item) => [item.day, item]));
    return ORDERED_DAYS.map((day) => map.get(day) || {
      day,
      day_type: day === "Saturday" || day === "Sunday" ? "Weekend" : "Weekday",
      usual_pattern: "No Data",
      avg_occupancy: 0,
      avg_noise_level: 0,
      avg_warnings: 0,
      avg_critical_ratio: 0,
      cluster_id: -1
    });
  }, [patternsData]);

  const roomOptions = useMemo(() => {
    const ids = new Set(["All"]);
    rooms.forEach((room) => {
      if (room.room_id) ids.add(room.room_id);
    });
    return Array.from(ids);
  }, [rooms]);

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

  if (loading) return <main className="page"><p>Loading Warden dashboard...</p></main>;

  return (
    <main className="page">
      <header className="header">
        <div>
          <h1>Warden Dashboard</h1>
          <p>Room monitoring, ML alerts, weekly patterns, anomalies and forecasts.</p>
        </div>

        <label className="filter">
          Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            {roomOptions.map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
        </label>
      </header>

      {error ? <div className="error-box">{error}</div> : null}

      <section className="kpi-grid">
        <article className="card kpi">
          <span>Occupied</span>
          <strong>{summary?.occupied_rooms ?? 0}</strong>
        </article>
        <article className="card kpi">
          <span>Empty</span>
          <strong>{summary?.empty_rooms ?? 0}</strong>
        </article>
        <article className="card kpi">
          <span>ML Alerts</span>
          <strong>{alerts.length}</strong>
        </article>
        <article className="card kpi">
          <span>Data Days</span>
          <strong>{formatNumber(dataRange?.total_days_covered, 1)}</strong>
          <small>{dataRange?.is_valid_5_to_7_days_or_more ? "Valid 5–7+ days" : "Insufficient range"}</small>
        </article>
      </section>

      <section className="two-column">
        <section className="card">
          <h2>Room Monitoring</h2>
          <div className="room-grid">
            {rooms.length ? rooms.map((room) => (
              <article className="room-tile" key={room.room_id}>
                <h3>{valueOrDash(room.room_id)}</h3>
                <p>Occupancy: <strong>{valueOrDash(room.occupancy_stat)}</strong></p>
                <p>Noise: <strong>{valueOrDash(room.noise_stat)}</strong></p>
                <p>Inspection: <strong>{room.needs_inspection ? "Yes" : "No"}</strong></p>
                <p>Door: <strong>{valueOrDash(room.door_status)}</strong></p>
              </article>
            )) : <p>No room records available.</p>}
          </div>
        </section>

        <section className="card">
          <h2>Active Alerts</h2>
          <div className="alert-list">
            {alerts.length ? alerts.map((alert, index) => (
              <article className="alert-card" key={`${alert.room_id}-${alert.captured_at}-${index}`}>
                <div>
                  <strong>{valueOrDash(alert.alert_type)}</strong>
                  <span>{valueOrDash(alert.severity)}</span>
                </div>
                <p>{valueOrDash(alert.reason)}</p>
                <small>{valueOrDash(alert.room_id)} · confidence {Math.round((alert.confidence || 0) * 100)}%</small>
              </article>
            )) : <p>No ML alerts available.</p>}
          </div>
        </section>
      </section>

      <section className="two-column">
        <section className="card chart-card">
          <h2>Historical and Forecasted Room Trend</h2>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" stroke="#2563eb" strokeDasharray="5 5" strokeWidth={2.5} dot={false} connectNulls />
              <Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" stroke="#f59e0b" strokeDasharray="5 5" strokeWidth={2.5} dot={false} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="card chart-card">
          <h2>7-Day History</h2>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={history}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="occupied_count" name="Occupied" fill="#2563eb" />
              <Bar dataKey="warning_count" name="Warnings" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </section>
      </section>

      <section className="card">
        <h2>Weekly Pattern Discovery</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Day</th>
                <th>Type</th>
                <th>Pattern</th>
                <th>Avg Occupancy</th>
                <th>Avg Noise Level</th>
                <th>Avg Warnings</th>
                <th>Avg Critical Ratio</th>
                <th>Cluster</th>
              </tr>
            </thead>
            <tbody>
              {patternsByDay.map((pattern) => (
                <tr key={pattern.day}>
                  <td>{pattern.day}</td>
                  <td>{pattern.day_type}</td>
                  <td><span className="badge">{pattern.usual_pattern}</span></td>
                  <td>{formatNumber(pattern.avg_occupancy)}</td>
                  <td>{formatNumber(pattern.avg_noise_level)}</td>
                  <td>{formatNumber(pattern.avg_warnings)}</td>
                  <td>{formatNumber(pattern.avg_critical_ratio)}%</td>
                  <td>{pattern.cluster_id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>Abnormal / Anomaly Records</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Room</th>
                <th>Date</th>
                <th>Status</th>
                <th>Score</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.length ? anomalies.slice(0, 8).map((item, index) => (
                <tr key={`${item.room_id}-${item.date}-${index}`}>
                  <td>{valueOrDash(item.room_id)}</td>
                  <td>{valueOrDash(item.date)}</td>
                  <td>{valueOrDash(item.status)}</td>
                  <td>{formatNumber(item.anomaly_score, 3)}</td>
                  <td>{valueOrDash(item.reason)}</td>
                </tr>
              )) : (
                <tr><td colSpan="5">No anomaly records available.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ChatAssistant roomId={roomId} />
    </main>
  );
}
