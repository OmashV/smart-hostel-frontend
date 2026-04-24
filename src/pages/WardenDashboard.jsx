import { useEffect, useMemo, useState } from "react";
import { HiOutlineBellAlert, HiOutlineChartBar, HiOutlineHomeModern, HiOutlineSparkles, HiOutlineWrenchScrewdriver } from "react-icons/hi2";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { chatWithDashboardAgent, getWardenAnomalies, getWardenDataRange, getWardenForecasts, getWardenHistory, getWardenMlAlerts, getWardenPatterns, getWardenRoomsStatus, getWardenSummary } from "../api/client";
import DataTable from "../components/DataTable";
import EmptyState from "../components/EmptyState";
import LoadingState from "../components/LoadingState";
import SectionCard from "../components/SectionCard";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import { formatDate } from "../utils/format";

const roomOptions = ["All", "A101", "A102", "A103", "A201", "A202", "A203"];

function buildTrend(history = [], forecasts = []) {
  const map = new Map();
  history.forEach((item) => map.set(item.date, { date: item.date, actual_occupancy: item.actual_occupancy, actual_warnings: item.actual_warnings }));
  forecasts.forEach((item) => {
    const row = map.get(item.date) || { date: item.date };
    row.predicted_occupancy = item.predicted_occupied_count;
    row.predicted_warnings = item.predicted_warning_count;
    map.set(item.date, row);
  });
  return [...map.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

function WardenAssistant({ dashboardState }) {
  const [message, setMessage] = useState("Which rooms have active alerts?");
  const [reply, setReply] = useState("Ask about active alerts, inspection rooms, weekly patterns, anomalies, or forecast.");
  const [busy, setBusy] = useState(false);

  async function ask(question = message) {
    if (!question.trim()) return;
    setBusy(true);
    try {
      const data = await chatWithDashboardAgent({ role: "warden", message: question, dashboardState });
      setReply(data.reply || "No answer returned.");
    } catch (error) {
      setReply(error.message || "Chatbot error");
    } finally {
      setBusy(false);
    }
  }

  const quick = ["Which rooms have active alerts?", "Which rooms need inspection?", "What is the weekly pattern?", "Show anomalies", "What is the forecast?"];
  return (
    <SectionCard title="Warden Chatbot / Assistant">
      <div className="warden-chatbox">
        <div className="warden-chat-quick">
          {quick.map((q) => <button key={q} type="button" onClick={() => { setMessage(q); ask(q); }}>{q}</button>)}
        </div>
        <div className="warden-chat-input">
          <input value={message} onChange={(e) => setMessage(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ask()} />
          <button type="button" onClick={() => ask()} disabled={busy}>{busy ? "Thinking..." : "Ask"}</button>
        </div>
        <p className="warden-chat-reply">{reply}</p>
      </div>
    </SectionCard>
  );
}

export default function WardenDashboard() {
  const [roomId, setRoomId] = useState("All");
  const [state, setState] = useState({ summary: null, rooms: [], alerts: [], history: [], forecasts: [], anomalies: [], patterns: [], dataRange: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    try {
      setError("");
      const [summary, rooms, alerts, history, forecasts, anomalies, patterns, dataRange] = await Promise.all([
        getWardenSummary(roomId),
        getWardenRoomsStatus(roomId),
        getWardenMlAlerts(roomId),
        getWardenHistory(roomId, 7),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenPatterns(roomId),
        getWardenDataRange(roomId)
      ]);
      setState({ summary, rooms: rooms.rooms || [], alerts: alerts.items || [], history: history.items || [], forecasts: forecasts.items || [], anomalies: anomalies.items || [], patterns: patterns.items || [], dataRange });
    } catch (err) {
      setError(err.message || "Failed to load Warden dashboard");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { setLoading(true); load(); }, [roomId]);
  useEffect(() => { const id = setInterval(load, 9000); return () => clearInterval(id); }, [roomId]);

  const trendData = useMemo(() => buildTrend(state.history, state.forecasts), [state.history, state.forecasts]);
  const dashboardState = useMemo(() => ({ roomId, ...state, trendData }), [roomId, state, trendData]);

  if (loading) return <LoadingState />;
  if (error) return <EmptyState text={error} />;

  return (
    <div className="owner-dashboard warden-dashboard page-grid">
      <div className="filter-bar">
        <label>Room filter<select value={roomId} onChange={(e) => setRoomId(e.target.value)}>{roomOptions.map((r) => <option key={r} value={r}>{r}</option>)}</select></label>
        <label>Auto refresh<select value="9s" disabled><option>Every 9 seconds</option></select></label>
      </div>

      <div className="stats-grid">
        <StatCard title="Total Rooms" value={state.summary?.total_rooms ?? 0} subtitle="Latest MongoDB room readings" icon={<HiOutlineHomeModern />} tone="blue" />
        <StatCard title="Occupied / Sleeping" value={`${state.summary?.occupied_rooms ?? 0} / ${state.summary?.sleeping_rooms ?? 0}`} subtitle="Real-time occupancy visibility" icon={<HiOutlineChartBar />} tone="green" />
        <StatCard title="Active ML Alerts" value={state.summary?.active_alerts ?? 0} subtitle="Learned threshold/anomaly alerts" icon={<HiOutlineBellAlert />} tone="red" />
        <StatCard title="Need Inspection" value={state.summary?.rooms_needing_inspection ?? 0} subtitle="Rooms for cleaning/warden action" icon={<HiOutlineWrenchScrewdriver />} tone="orange" />
      </div>

      <div className="warden-side-grid">
        <SectionCard title="Room Monitoring">
          {state.rooms.length ? <div className="owner-room-grid warden-room-grid">{state.rooms.map((room) => <div className={`owner-room-tile ${room.needs_inspection ? "warning" : "normal"}`} key={room.room_id}><div className="tile-top"><div><h3>{room.room_id}</h3><p className="tile-subtext">{room.device_id}</p></div><span className={`tile-dot ${room.needs_inspection ? "orange" : "green"}`} /></div><div className="tile-metrics"><div className="tile-row"><span>Occupancy</span><strong>{room.occupancy_stat}</strong></div><div className="tile-row"><span>Noise</span><strong>{room.sound_peak ?? 0}</strong></div><div className="tile-row"><span>Door</span><strong>{room.door_status}</strong></div><div className="tile-row"><span>Alerts</span><strong>{room.active_alert_count}</strong></div></div><div className="tile-footer"><span>{room.needs_inspection ? "Inspection needed" : "Normal"}</span><span>{formatDate(room.captured_at)}</span></div></div>)}</div> : <EmptyState text="No room readings found" />}
        </SectionCard>

        <SectionCard title="Active Alerts">
          {state.alerts.length ? <div className="alerts-list">{state.alerts.slice(0, 8).map((a) => <div className={`alert-card ${a.severity === "Critical" ? "critical" : "warning"}`} key={`${a.room_id}-${a.captured_at}`}><div className="alert-title-row"><strong>{a.room_id} — {a.title}</strong><StatusBadge value={a.severity} /></div><p>{a.message}</p><div className="alert-meta"><span>Score: {a.anomaly_score}</span><span>{formatDate(a.captured_at)}</span></div><small>{(a.evidence || []).join(" • ")}</small></div>)}</div> : <EmptyState text="No active ML alerts" />}
        </SectionCard>
      </div>

      <SectionCard title="Historical and Forecasted Room Trend">
        <div className="chart-tall">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={trendData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Line type="monotone" dataKey="actual_occupancy" name="Actual Occupancy" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="actual_warnings" name="Actual Warnings" strokeWidth={2} dot={false} /><Line type="monotone" dataKey="predicted_occupancy" name="Predicted Occupancy" strokeWidth={2} strokeDasharray="5 5" /><Line type="monotone" dataKey="predicted_warnings" name="Predicted Warnings" strokeWidth={2} strokeDasharray="5 5" /></LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <div className="warden-side-grid">
        <SectionCard title="Abnormal / Action Days">
          {state.anomalies.length ? <ResponsiveContainer width="100%" height={260}><BarChart data={state.anomalies.slice(0, 12).map((a) => ({ ...a, label: `${a.room_id} ${String(a.date).slice(5,10)}` }))}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="label" /><YAxis /><Tooltip /><Legend /><Bar dataKey="avg_sound_peak" name="Avg Sound" /><Bar dataKey="anomaly_score" name="Anomaly Score" /></BarChart></ResponsiveContainer> : <EmptyState text="No anomaly rows" />}
        </SectionCard>
        <SectionCard title="7-Day Noise & Current Story">
          <ResponsiveContainer width="100%" height={260}><AreaChart data={state.history}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" /><YAxis /><Tooltip /><Legend /><Area type="monotone" dataKey="avg_noise_level" name="Avg Noise" /><Area type="monotone" dataKey="avg_current" name="Avg Current" /></AreaChart></ResponsiveContainer>
        </SectionCard>
      </div>

      <SectionCard title="Weekly Pattern Discovery">
        <DataTable rows={state.patterns} columns={[{ key: "day", label: "Day" }, { key: "day_type", label: "Day Type" }, { key: "usual_pattern", label: "Usual Pattern" }, { key: "avg_occupancy", label: "Avg Occupancy" }, { key: "avg_noise_level", label: "Avg Noise Level" }, { key: "avg_warnings", label: "Avg Warnings" }, { key: "avg_critical_ratio", label: "Avg Critical Ratio" }, { key: "cluster_id", label: "Cluster ID" }]} />
      </SectionCard>

      <SectionCard title="Data Range / Validity">
        <div className="stats-grid"><StatCard title="Total Records" value={state.dataRange?.total_records ?? 0} subtitle="MongoDB sensor records" icon={<HiOutlineSparkles />} tone="purple" /><StatCard title="Days Covered" value={state.dataRange?.total_days_covered ?? 0} subtitle={state.dataRange?.validity_status} icon={<HiOutlineChartBar />} tone="green" /><StatCard title="First Timestamp" value={formatDate(state.dataRange?.first_timestamp)} subtitle="Earliest record" icon={<HiOutlineHomeModern />} tone="blue" /><StatCard title="Last Timestamp" value={formatDate(state.dataRange?.last_timestamp)} subtitle="Latest record" icon={<HiOutlineBellAlert />} tone="orange" /></div>
      </SectionCard>

      <WardenAssistant dashboardState={dashboardState} />
    </div>
  );
}
