import { useEffect, useMemo, useRef, useState } from "react";
import {
  HiOutlineBellAlert,
  HiOutlineExclamationTriangle,
  HiOutlineHomeModern,
  HiOutlineSpeakerWave,
  HiOutlineWrenchScrewdriver
} from "react-icons/hi2";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  getAvailableFloors,
  getAvailableRooms,
  getWardenAnomalies,
  getWardenFeatureImportance,
  getWardenForecasts,
  getWardenHistory,
  getWardenMlAlerts,
  getWardenPatterns,
  getWardenRoomsStatus,
  getWardenSummary
} from "../api/client";
import StatCard from "../components/StatCard";
import SectionCard from "../components/SectionCard";
import StatusBadge from "../components/StatusBadge";
import DataTable from "../components/DataTable";
import LoadingState from "../components/LoadingState";
import EmptyState from "../components/EmptyState";
import { formatDate } from "../utils/format";

const ORDERED_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const chartTooltipStyle = {
  background: "#ffffff",
  border: "1px solid #dbe2ea",
  borderRadius: "12px",
  color: "#172033",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)"
};

function renderFaults(faults = {}) {
  const active = Object.entries(faults || {})
    .filter(([, value]) => value)
    .map(([key]) => key.toUpperCase());
  return active.length ? active.join(", ") : "None";
}

function renderReasons(reasons = []) {
  return reasons?.length ? reasons.join(", ") : "-";
}

function getLastNDates(days = 7) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i -= 1) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }
  return dates;
}

function getFloor(room = {}) {
  if (room.floor_id) return room.floor_id;
  const text = String(room.room_id || "").trim().toUpperCase();
  const digit = text.match(/(\d)/);
  return digit ? `Floor ${digit[1]}` : "Other";
}

function makeEmptyRoom(roomId) {
  return {
    room_id: roomId,
    occupancy_stat: "No Data",
    noise_stat: "No Data",
    waste_stat: "No Data",
    door_status: "No Data",
    current_amp: 0,
    sound_peak: 0,
    sensor_faults: {},
    needs_inspection: false,
    inspection_reasons: [],
    captured_at: null
  };
}

function historyTone(value = "") {
  const text = String(value || "").toLowerCase();
  if (text.includes("critical") || text.includes("abnormal") || text.includes("high") || text.includes("violation")) return "danger";
  if (text.includes("warning") || text.includes("moderate") || text.includes("inspection")) return "warning";
  if (text.includes("normal") || text.includes("stable") || text.includes("weekday") || text.includes("weekend")) return "ok";
  return "neutral";
}

function HistoryWord({ value }) {
  return <span className={`history-word ${historyTone(value)}`}>{value || "-"}</span>;
}

function PatternBadge({ value }) {
  return <span className={`pattern-badge ${historyTone(value)}`}>{value || "No Data"}</span>;
}

function WardenAlertCard({ alert, onOpen }) {
  const severity = alert.severity || "Warning";
  const cls = severity === "Critical" ? "alert-card critical" : severity === "Warning" ? "alert-card warning" : "alert-card info";
  return (
    <button type="button" className={`warden-alert-button ${cls}`} onClick={() => onOpen(alert)} title="Click to view ML alert details">
      <div className="alert-card-head">
        <div className="alert-card-title">
          {severity === "Critical" ? <HiOutlineExclamationTriangle size={18} /> : <HiOutlineBellAlert size={18} />}
          <strong>{alert.alert_type || "ML Alert"}</strong>
        </div>
        <StatusBadge value={severity} />
      </div>
      <p className="alert-card-message">{alert.reason || "Model-generated alert"}</p>
      <div className="alert-card-foot">
        <span>{alert.room_id}</span>
        <span>{Math.round(Number(alert.confidence || 0) * 100)}% confidence</span>
      </div>
    </button>
  );
}

function WardenRoomTile({ room }) {
  const needsAttention = room.needs_inspection || ["Warning", "Violation"].includes(room.noise_stat) || ["Warning", "Critical"].includes(room.waste_stat);
  const tileClass = needsAttention ? "owner-room-tile warning" : "owner-room-tile normal";
  return (
    <div className={`${tileClass} warden-room-tile`} title={`${room.room_id} current status`}>
      <div className="tile-top">
        <div>
          <h3>{room.room_id}</h3>
          <p className="tile-subtext">Room monitoring</p>
        </div>
        <span className={`tile-dot ${needsAttention ? "orange" : "green"}`} />
      </div>
      {room.needs_inspection ? <div className="tile-alert-pill">Inspection</div> : null}
      <div className="tile-metrics">
        <div className="tile-row"><span>Occupancy</span><strong>{room.occupancy_stat}</strong></div>
        <div className="tile-row"><span>Noise</span><strong>{room.noise_stat}</strong></div>
        <div className="tile-row"><span>Door</span><strong>{room.door_status}</strong></div>
        <div className="tile-row"><span>Current</span><strong>{room.current_amp} A</strong></div>
      </div>
      <div className="tile-badges">
        <StatusBadge value={room.occupancy_stat} />
        <StatusBadge value={room.noise_stat} />
        <StatusBadge value={room.waste_stat} />
      </div>
      <div className="tile-footer">Last Activity <span>{room.captured_at ? formatDate(room.captured_at) : "No Data"}</span></div>
    </div>
  );
}

function KpiCardButton({ children, onClick, title }) {
  return <button type="button" className="warden-kpi-button" onClick={onClick} title={title}>{children}</button>;
}

export default function WardenDashboard() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [wardenHistory, setWardenHistory] = useState([]);
  const [mlAlerts, setMlAlerts] = useState([]);
  const [wardenForecasts, setWardenForecasts] = useState([]);
  const [wardenAnomalies, setWardenAnomalies] = useState([]);
  const [wardenPatterns, setWardenPatterns] = useState([]);
  const [wardenFeatureImportance, setWardenFeatureImportance] = useState([]);
  const [error, setError] = useState("");

  const [selectedFloor, setSelectedFloor] = useState("All");
  const [floorOptions, setFloorOptions] = useState(["All"]);
  const [roomOptions, setRoomOptions] = useState(["All"]);
  const [selectedRoomFilter, setSelectedRoomFilter] = useState("All");
  const [onlyAttention, setOnlyAttention] = useState(false);
  const [selectedKpi, setSelectedKpi] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);

  const selectedRoomFilterRef = useRef(selectedRoomFilter);
  useEffect(() => { selectedRoomFilterRef.current = selectedRoomFilter; }, [selectedRoomFilter]);

  useEffect(() => {
    getAvailableFloors().then((res) => setFloorOptions(["All", ...(res?.floors || [])])).catch(() => {});
  }, []);

  useEffect(() => {
    getAvailableRooms(selectedFloor).then((res) => {
      const next = ["All", ...(res?.rooms || [])];
      setRoomOptions(next);
      if (!next.includes(selectedRoomFilterRef.current)) setSelectedRoomFilter("All");
    }).catch(() => {});
  }, [selectedFloor]);

  async function load() {
    try {
      setError("");
      const roomId = selectedRoomFilterRef.current;
      const [summaryRes, roomsRes, historyRes, forecastRes, anomalyRes, patternRes, featureRes, alertRes] = await Promise.all([
        getWardenSummary(),
        getWardenRoomsStatus(),
        getWardenHistory(7, roomId),
        getWardenForecasts(roomId),
        getWardenAnomalies(roomId),
        getWardenPatterns(roomId),
        getWardenFeatureImportance(),
        getWardenMlAlerts(roomId, 20)
      ]);
      setSummary(summaryRes || null);
      setRooms(roomsRes?.rooms || []);
      setWardenHistory(historyRes?.items || []);
      setWardenForecasts(forecastRes?.items || []);
      setWardenAnomalies(anomalyRes?.items || []);
      setWardenPatterns(patternRes?.items || []);
      setWardenFeatureImportance(featureRes?.items || []);
      setMlAlerts(alertRes?.items || []);
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || "Failed to load warden dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let timeoutId;
    let cancelled = false;
    async function loop() {
      const start = Date.now();
      await load();
      if (cancelled) return;
      timeoutId = setTimeout(loop, Math.max(8000 - (Date.now() - start), 0));
    }
    setLoading(true);
    loop();
    return () => { cancelled = true; if (timeoutId) clearTimeout(timeoutId); };
  }, [selectedRoomFilter]);

  const floors = useMemo(() => Array.from(new Set(["All", ...floorOptions, ...rooms.map((room) => getFloor(room))])).sort(), [rooms, floorOptions]);

  const dynamicRoomOptions = useMemo(() => {
    const derived = rooms.filter((room) => selectedFloor === "All" || getFloor(room) === selectedFloor).map((room) => room.room_id).sort();
    return Array.from(new Set(["All", ...roomOptions, ...derived])).filter((roomId) => {
      if (roomId === "All") return true;
      const room = rooms.find((entry) => entry.room_id === roomId);
      return selectedFloor === "All" || !room || getFloor(room) === selectedFloor;
    });
  }, [rooms, roomOptions, selectedFloor]);

  const selectedRoomData = useMemo(() => selectedRoomFilter === "All" ? null : rooms.find((room) => room.room_id === selectedRoomFilter) || makeEmptyRoom(selectedRoomFilter), [rooms, selectedRoomFilter]);

  const filteredRooms = useMemo(() => rooms.filter((room) => {
    const matchFloor = selectedFloor === "All" || getFloor(room) === selectedFloor;
    const matchRoom = selectedRoomFilter === "All" || room.room_id === selectedRoomFilter;
    const needsAttention = room.needs_inspection || ["Warning", "Violation"].includes(room.noise_stat) || ["Warning", "Critical"].includes(room.waste_stat);
    return matchFloor && matchRoom && (!onlyAttention || needsAttention);
  }), [rooms, selectedFloor, selectedRoomFilter, onlyAttention]);

  const sevenDayHistory = useMemo(() => {
    const byDate = new Map((wardenHistory || []).map((item) => [item.date, item]));
    return getLastNDates(7).map((date) => {
      const item = byDate.get(date) || {};
      return {
        date,
        occupied: Number(item.occupied_count || 0),
        empty: Number(item.empty_count || 0),
        normal: Math.max(Number(item.occupied_count || 0) + Number(item.empty_count || 0) - Number(item.violation_count || 0) - Number(item.warning_count || 0), 0),
        critical: Number(item.violation_count || 0) + Number(item.warning_count || 0)
      };
    });
  }, [wardenHistory]);

  const forecastChartData = useMemo(() => {
    if (selectedRoomFilter === "All") return [];
    const actual = new Map((wardenHistory || []).map((item) => [item.date, {
      date: item.date,
      occupied_count: Number(item.occupied_count || 0),
      warning_count: Number(item.warning_count || 0)
    }]));
    (wardenForecasts || []).forEach((item) => {
      const row = actual.get(item.date) || { date: item.date };
      row.predicted_occupied_count = Number(item.predicted_occupied_count || 0);
      row.predicted_warning_count = Number(item.predicted_warning_count || 0);
      actual.set(item.date, row);
    });
    return Array.from(actual.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [wardenHistory, wardenForecasts, selectedRoomFilter]);

  const forecastSplitDate = useMemo(() => (wardenForecasts?.[0]?.date || null), [wardenForecasts]);

  const displayedOccupied = selectedRoomFilter === "All" ? summary?.occupied_rooms ?? 0 : selectedRoomData?.occupancy_stat === "Occupied" ? 1 : 0;
  const displayedEmpty = selectedRoomFilter === "All" ? summary?.empty_rooms ?? 0 : selectedRoomData?.occupancy_stat === "Empty" ? 1 : 0;
  const displayedAlerts = mlAlerts.length;
  const cleaningPriorityRooms = useMemo(() => (selectedRoomFilter === "All" ? rooms : [selectedRoomData].filter(Boolean)).filter((room) => room.needs_inspection || String(room.occupancy_stat || "").toLowerCase() === "empty"), [rooms, selectedRoomFilter, selectedRoomData]);

  if (loading) return <LoadingState />;

  return (
    <div className="page-grid owner-dashboard">
      <div className="filter-bar warden-filter-bar">
        <label>Floor<select value={selectedFloor} onChange={(e) => { setSelectedFloor(e.target.value); setSelectedRoomFilter("All"); }}>{floors.map((floor) => <option key={floor} value={floor}>{floor}</option>)}</select></label>
        <label>Room<select value={selectedRoomFilter} onChange={(e) => setSelectedRoomFilter(e.target.value)}>{dynamicRoomOptions.map((roomId) => <option key={roomId} value={roomId}>{roomId}</option>)}</select></label>
        <label>View<select value={onlyAttention ? "attention" : "all"} onChange={(e) => setOnlyAttention(e.target.value === "attention")}><option value="all">All Rooms</option><option value="attention">Needs Action Only</option></select></label>
      </div>

      {error ? <div className="warden-error-box"><strong>Dashboard error:</strong> {error}<button className="warden-retry-btn" onClick={load}>Retry</button></div> : null}

      <div className="stats-grid">
        <KpiCardButton onClick={() => setSelectedKpi("occupied")} title="Occupied room drill-down"><StatCard title="Occupied Rooms" value={displayedOccupied} subtitle="Current occupied rooms" icon={<HiOutlineHomeModern />} tone="blue" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("empty")} title="Empty room drill-down"><StatCard title="Empty Rooms" value={displayedEmpty} subtitle="Useful for cleaning allocation" icon={<HiOutlineHomeModern />} tone="green" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("alerts")} title="ML alert drill-down"><StatCard title="Active ML Alerts" value={displayedAlerts} subtitle="Model-generated risk alerts" icon={<HiOutlineSpeakerWave />} tone="orange" /></KpiCardButton>
        <KpiCardButton onClick={() => setSelectedKpi("priority")} title="Cleaning priority drill-down"><StatCard title="Cleaning Priority" value={cleaningPriorityRooms.length} subtitle="Rooms that need action" icon={<HiOutlineWrenchScrewdriver />} tone="red" /></KpiCardButton>
      </div>

      {selectedRoomFilter === "All" ? (
        <>
          <div className="owner-top-grid">
            <SectionCard title="Room Monitoring">
              {filteredRooms.length ? <div className="room-tile-grid">{filteredRooms.map((room) => <WardenRoomTile key={room.room_id} room={room} />)}</div> : <EmptyState text="No rooms match the selected filters." />}
            </SectionCard>
            <SectionCard title="Active Alerts">
              {mlAlerts.length ? <div className="alerts-list">{mlAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No ML alerts available. Run the Warden ML script after collecting data." />}
            </SectionCard>
          </div>
          <div className="owner-top-grid">
            <SectionCard title="7-Day Occupancy Trend">
              <div className="chart-shell"><ResponsiveContainer width="100%" height={320}><BarChart data={sevenDayHistory}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[8, 8, 0, 0]} /><Bar dataKey="empty" name="Empty" fill="#16a34a" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div>
            </SectionCard>
            <SectionCard title="7-Day Noise Trend">
              <div className="chart-shell"><ResponsiveContainer width="100%" height={320}><AreaChart data={sevenDayHistory}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Area type="monotone" dataKey="normal" name="Normal" stroke="#16a34a" fill="#16a34a" fillOpacity={0.18} strokeWidth={2} /><Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fill="#ef4444" fillOpacity={0.18} strokeWidth={2} /></AreaChart></ResponsiveContainer></div>
            </SectionCard>
          </div>
        </>
      ) : (
        <>
          <div className="owner-top-grid">
            <SectionCard title={`Room Overview - ${selectedRoomFilter}`}>
              <div className="warden-room-hero">
                <div className="warden-room-hero-top"><div><p className="warden-room-eyebrow">Detailed room monitoring</p><h3>{selectedRoomData.room_id}</h3><p className="warden-room-meta">Last activity {selectedRoomData.captured_at ? formatDate(selectedRoomData.captured_at) : "No Data"}</p></div><div className="tile-badges"><StatusBadge value={selectedRoomData.occupancy_stat} /><StatusBadge value={selectedRoomData.noise_stat} /><StatusBadge value={selectedRoomData.waste_stat} /><StatusBadge value={selectedRoomData.door_status} /></div></div>
                <div className="warden-room-hero-grid"><div className="warden-room-info-card"><span>Current</span><strong>{selectedRoomData.current_amp} A</strong></div><div className="warden-room-info-card"><span>Sound Peak</span><strong>{selectedRoomData.sound_peak}</strong></div><div className="warden-room-info-card"><span>Needs Action</span><strong>{selectedRoomData.needs_inspection ? "Yes" : "No"}</strong></div><div className="warden-room-info-card"><span>Sensor Faults</span><strong>{renderFaults(selectedRoomData.sensor_faults)}</strong></div></div>
                <div className="warden-room-notes"><span className="history-word neutral">Reasons</span><p>{renderReasons(selectedRoomData.inspection_reasons)}</p></div>
              </div>
            </SectionCard>
            <SectionCard title={`Active ML Alerts - ${selectedRoomFilter}`}>{mlAlerts.length ? <div className="alerts-list">{mlAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No ML alerts for this room." />}</SectionCard>
          </div>
          <div className="owner-top-grid">
            <SectionCard title={`7-Day Occupancy Trend - ${selectedRoomFilter}`}><div className="chart-shell"><ResponsiveContainer width="100%" height={320}><BarChart data={sevenDayHistory}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Bar dataKey="occupied" name="Occupied" fill="#2563eb" radius={[8, 8, 0, 0]} /><Bar dataKey="empty" name="Empty" fill="#16a34a" radius={[8, 8, 0, 0]} /></BarChart></ResponsiveContainer></div></SectionCard>
            <SectionCard title={`7-Day Noise Trend - ${selectedRoomFilter}`}><div className="chart-shell"><ResponsiveContainer width="100%" height={320}><AreaChart data={sevenDayHistory}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><YAxis tick={{ fill: "#64748b", fontSize: 12 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Area type="monotone" dataKey="normal" name="Normal" stroke="#16a34a" fill="#16a34a" fillOpacity={0.18} strokeWidth={2} /><Area type="monotone" dataKey="critical" name="Critical" stroke="#ef4444" fill="#ef4444" fillOpacity={0.18} strokeWidth={2} /></AreaChart></ResponsiveContainer></div></SectionCard>
          </div>
        </>
      )}

      <SectionCard title={`Recent ML Alerts History - ${selectedRoomFilter}`}>
        {mlAlerts.length ? <DataTable columns={[{ key: "captured_at", label: "Detected At", render: (row) => formatDate(row.captured_at) }, { key: "room_id", label: "Room" }, { key: "alert_type", label: "Alert Type", render: (row) => <HistoryWord value={row.alert_type} /> }, { key: "severity", label: "Severity", render: (row) => <HistoryWord value={row.severity} /> }, { key: "confidence", label: "Confidence", render: (row) => `${Math.round(Number(row.confidence || 0) * 100)}%` }, { key: "model_name", label: "Model" }]} rows={mlAlerts} /> : <EmptyState text="No ML alert history found." />}
      </SectionCard>

      {selectedRoomFilter !== "All" ? (
        <div className="warden-analysis-zone">
          <SectionCard title={`Data Analysis & Insights - ${selectedRoomFilter}`}>
            <div className="warden-analysis-stack">
              <SectionCard title="Historical and Forecasted Room Trend">
                {forecastChartData.length ? (
                  <ResponsiveContainer width="100%" height={360}>
                    <LineChart data={forecastChartData} margin={{ top: 10, right: 24, left: 6, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" />
                      <XAxis dataKey="date" tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} interval="preserveStartEnd" minTickGap={22} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 11 }} tickLine={false} axisLine={{ stroke: "#e2e8f0" }} domain={["auto", "auto"]} allowDecimals={false} />
                      <Tooltip contentStyle={chartTooltipStyle} labelFormatter={(label) => `Date: ${label}`} formatter={(value, name) => [Number(value ?? 0).toFixed(2), name]} />
                      {forecastSplitDate ? <ReferenceLine x={forecastSplitDate} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="visible" label={{ value: "forecast", position: "insideTopLeft", fill: "#0f172a", fontSize: 12 }} /> : null}
                      <Legend verticalAlign="bottom" align="center" height={28} iconType="plainline" />
                      <Line type="monotone" dataKey="occupied_count" name="Actual Occupancy" stroke="#2563eb" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Line type="monotone" dataKey="warning_count" name="Actual Warnings" stroke="#f59e0b" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Line type="monotone" dataKey="predicted_occupied_count" name="Predicted Occupancy" stroke="#2563eb" strokeWidth={2.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} connectNulls />
                      <Line type="monotone" dataKey="predicted_warning_count" name="Predicted Warnings" stroke="#f59e0b" strokeWidth={2.5} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} connectNulls />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <EmptyState text="No room-level forecast data available. Run the Warden ML script." />}
              </SectionCard>

              <SectionCard title="Abnormal Noise / Action Days">
                {wardenAnomalies.length ? <div className="table-wrap nice-table-wrap full-balance-table"><table className="data-table enhanced-data-table"><colgroup><col style={{ width: "18%" }} /><col style={{ width: "18%" }} /><col style={{ width: "16%" }} /><col style={{ width: "48%" }} /></colgroup><thead><tr><th>Date</th><th>Anomaly Score</th><th>Status</th><th>Reason</th></tr></thead><tbody>{wardenAnomalies.map((item, idx) => <tr key={`${item.date}-${idx}`}><td>{item.date || "-"}</td><td><span className="score-pill score-danger">{Number(item.anomaly_score || 0).toFixed(3)}</span></td><td><span className="badge danger">{item.status || "Abnormal"}</span></td><td className="reason-cell"><HistoryWord value={item.reason || "IsolationForest anomaly"} /></td></tr>)}</tbody></table></div> : <EmptyState text="No abnormal room days detected yet." />}
              </SectionCard>

              <SectionCard title="Weekly Pattern Discovery">
                {wardenPatterns.length ? <div className="table-wrap nice-table-wrap full-balance-table"><table className="data-table enhanced-data-table"><colgroup><col style={{ width: "14%" }} /><col style={{ width: "12%" }} /><col style={{ width: "22%" }} /><col style={{ width: "13%" }} /><col style={{ width: "13%" }} /><col style={{ width: "12%" }} /><col style={{ width: "14%" }} /></colgroup><thead><tr><th>Day</th><th>Type</th><th>Usual Pattern</th><th>Avg Occupancy</th><th>Avg Noise Level</th><th>Avg Warnings</th><th>Avg Critical Ratio</th></tr></thead><tbody>{ORDERED_DAYS.map((day) => wardenPatterns.find((p) => p.day === day) || { day, day_type: ["Saturday", "Sunday"].includes(day) ? "Weekend" : "Weekday", usual_pattern: "No Data", avg_occupancy: 0, avg_noise_level: 0, avg_warnings: 0, avg_critical_ratio: 0 }).map((item) => <tr key={item.day}><td>{item.day}</td><td><span className="badge ok">{item.day_type}</span></td><td><PatternBadge value={item.usual_pattern} /></td><td>{Number(item.avg_occupancy || 0).toFixed(2)}</td><td>{Number(item.avg_noise_level || 0).toFixed(2)}</td><td>{Number(item.avg_warnings || 0).toFixed(2)}</td><td>{Number(item.avg_critical_ratio || 0).toFixed(2)}%</td></tr>)}</tbody></table></div> : <EmptyState text="No weekly pattern data available. Run the KMeans ML script." />}
              </SectionCard>

              <SectionCard title="ML Feature Importance">
                {wardenFeatureImportance.length ? <ResponsiveContainer width="100%" height={320}><BarChart data={wardenFeatureImportance} layout="vertical" margin={{ left: 30 }}><CartesianGrid strokeDasharray="3 3" stroke="#d9e1ec" /><XAxis type="number" tick={{ fill: "#64748b", fontSize: 12 }} /><YAxis type="category" dataKey="feature" width={160} tick={{ fill: "#64748b", fontSize: 12 }} /><Tooltip contentStyle={chartTooltipStyle} /><Legend /><Bar dataKey="importance" name="Importance" fill="#22c55e" radius={[0, 8, 8, 0]} /></BarChart></ResponsiveContainer> : <EmptyState text="No feature importance data available." />}
              </SectionCard>
            </div>
          </SectionCard>
        </div>
      ) : null}

      {selectedKpi ? <div className="warden-modal-overlay" onClick={() => setSelectedKpi(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>{selectedKpi === "occupied" && "Occupied Rooms"}{selectedKpi === "empty" && "Empty Rooms"}{selectedKpi === "alerts" && "Active ML Alerts"}{selectedKpi === "priority" && "Cleaning Priority"}</h3><button onClick={() => setSelectedKpi(null)}>Close</button></div>{selectedKpi === "alerts" ? (mlAlerts.length ? <div className="alerts-list">{mlAlerts.map((alert, index) => <WardenAlertCard key={`${alert.room_id}-${alert.captured_at}-modal-${index}`} alert={alert} onOpen={setSelectedAlert} />)}</div> : <EmptyState text="No active ML alerts." />) : selectedKpi === "priority" ? <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "inspection_reasons", label: "Reason", render: (row) => renderReasons(row.inspection_reasons) }, { key: "captured_at", label: "Updated", render: (row) => row.captured_at ? formatDate(row.captured_at) : "No Data" }]} rows={cleaningPriorityRooms} /> : <DataTable columns={[{ key: "room_id", label: "Room" }, { key: "occupancy_stat", label: "Occupancy", render: (row) => <StatusBadge value={row.occupancy_stat} /> }, { key: "noise_stat", label: "Noise", render: (row) => <StatusBadge value={row.noise_stat} /> }, { key: "captured_at", label: "Updated", render: (row) => row.captured_at ? formatDate(row.captured_at) : "No Data" }]} rows={selectedKpi === "occupied" ? rooms.filter((r) => r.occupancy_stat === "Occupied") : rooms.filter((r) => r.occupancy_stat === "Empty")} />}</div></div> : null}

      {selectedAlert ? <div className="warden-modal-overlay" onClick={() => setSelectedAlert(null)}><div className="warden-modal" onClick={(e) => e.stopPropagation()}><div className="warden-modal-head"><h3>{selectedAlert.alert_type}</h3><button onClick={() => setSelectedAlert(null)}>Close</button></div><div className="warden-single-room-grid"><div className="warden-single-room-card"><h4>ML Alert Details</h4><p><strong>Room:</strong> {selectedAlert.room_id}</p><p><strong>Severity:</strong> {selectedAlert.severity}</p><p><strong>Confidence:</strong> {Math.round(Number(selectedAlert.confidence || 0) * 100)}%</p><p><strong>Model:</strong> {selectedAlert.model_name}</p><p><strong>Detected At:</strong> {selectedAlert.captured_at ? formatDate(selectedAlert.captured_at) : "No Data"}</p></div><div className="warden-single-room-card"><h4>Model Explanation</h4><p>{selectedAlert.reason}</p><p><strong>Anomaly Score:</strong> {Number(selectedAlert.source_anomaly_score || 0).toFixed(3)}</p><p><strong>Alert Probability:</strong> {Number(selectedAlert.source_alert_probability || 0).toFixed(3)}</p></div></div></div></div> : null}
    </div>
  );
}
